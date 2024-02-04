import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

/** 判断 hook 是否在此文件内 */
export const checkThePathIsCorrect = async (
  path: string,
  hookName: string
): Promise<string> => {
  if (!fs.existsSync(path)) {
    return '';
  }

  const { success, line } = await checkTheHookIsBeDeclaredInTheFile(
    path,
    hookName
  );

  if (success) {
    return path + ':' + line;
  }

  return await checkTheHookIsBeExportedInTheFile(path, hookName);
};

/** 判断 hook 是否在此文件内声明 */
const checkTheHookIsBeDeclaredInTheFile = async (
  filePath: string,
  hookName: string
): Promise<{
  success: boolean;
  line: number;
}> => {
  const sourceFile = ts.createSourceFile(
    'tempFile.ts',
    await readFileAsync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );

  const variables: Array<{ var: string; line: number }> = [];

  const visit = (node: ts.Node) => {
    const getLine = (node: ts.Node) => {
      const lineChar = sourceFile.getLineAndCharacterOfPosition(
        node.getStart()
      );
      return lineChar.line + 1; // TS API 返回的行号是从 0 开始的，所以要加 1
    };

    if (ts.isVariableDeclaration(node)) {
      variables.push({
        var: node.name.getText(sourceFile),
        line: getLine(node),
      });
    }

    if (ts.isFunctionDeclaration(node)) {
      variables.push({
        var: node.name?.getText(sourceFile) || '',
        line: getLine(node),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const theVar = variables.filter((item) => item.var === hookName);

  return { success: theVar.length > 0, line: theVar[0]?.line || 0 };
};

/** 判断 hook 是否在此文件内导出 */
const checkTheHookIsBeExportedInTheFile = async (
  filePath: string,
  hookName: string
) => {
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContents,
    ts.ScriptTarget.ES2015,
    true
  );

  const exportStatements: Array<Array<string>> = [];

  const visit = (node: ts.Node) => {
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile);
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => {
          if (element.propertyName && element.name) {
            const exportedAs = element.name.getText(sourceFile);
            const originalName = element.propertyName.getText(sourceFile);
            if (originalName === 'default' && exportedAs === hookName) {
              exportStatements.push([exportedAs, moduleSpecifier]);
            }
          }
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  let tempFilePath = '';
  const filteredExportStatements = exportStatements.filter(
    (statement) => statement[0] === hookName
  );

  if (filteredExportStatements.length > 0) {
    tempFilePath = path
      .resolve(
        path.dirname(filePath),
        filteredExportStatements[0][1].replace("'", '')
      )
      .replace("'", '');
  }

  let finalFilePath = tempFilePath;

  if (
    tempFilePath &&
    !(tempFilePath.endsWith('.tsx') || tempFilePath.endsWith('.ts'))
  ) {
    finalFilePath = await checkWhitePathIsCorrect(tempFilePath, hookName);
  }

  return finalFilePath;
};

export const checkWhitePathIsCorrect = async (
  filePath: string,
  hookName: string
): Promise<string> => {
  return (
    (await checkThePathIsCorrect(`${filePath}.ts`, hookName)) ||
    (await checkThePathIsCorrect(`${filePath}.tsx`, hookName)) ||
    (await checkThePathIsCorrect(`${filePath}/index.ts`, hookName)) ||
    (await checkThePathIsCorrect(`${filePath}/index.tsx`, hookName))
  );
};
