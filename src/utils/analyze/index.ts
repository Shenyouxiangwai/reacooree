import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { promisify } from 'util';

/**
 * TODO: '@' 路径动态化查找 -> ts 项目优先查找 tsconfig.json（取最近路径的 tsconfig.json）-> 查找 webpack.config.json -> 取用户的配置 -> 取 '/src' 作为兜底
 */

export type Import = {
  path: string;
  import: string;
  absolutePath?: string;
  child?: Array<Import>;
};

const readFileAsync = promisify(fs.readFile);

/** 获取引入的绝对路径 */
const getImportFilePath = async (
  filePath: string,
  moduleName: string,
  hookName: string
): Promise<string> => {
  let basicFilePath = '',
    finalFilePath = '';

  /** 判断是绝对路径还是相对路径 -> 获取基础的文件路径 */
  if (moduleName.startsWith('@')) {
    basicFilePath = `${filePath.split('/src')[0] + '/src'}/${
      moduleName.split('@/')[1]
    }`;
  } else {
    basicFilePath = path.resolve(path.dirname(filePath), moduleName);
  }

  if (!(basicFilePath.endsWith('.tsx') || basicFilePath.endsWith('.ts'))) {
    finalFilePath =
      (await checkThePathIsCorrect(`${basicFilePath}.ts`, hookName)) ||
      (await checkThePathIsCorrect(`${basicFilePath}.tsx`, hookName)) ||
      (await checkThePathIsCorrect(`${basicFilePath}/index.ts`, hookName)) ||
      (await checkThePathIsCorrect(`${basicFilePath}/index.tsx`, hookName));
  } else {
    finalFilePath = basicFilePath;
  }

  return finalFilePath;
};

/** 判断 hook 是否在此文件内 */
const checkThePathIsCorrect = async (
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
    finalFilePath =
      (await checkThePathIsCorrect(`${tempFilePath}.ts`, hookName)) ||
      (await checkThePathIsCorrect(`${tempFilePath}.tsx`, hookName)) ||
      (await checkThePathIsCorrect(`${tempFilePath}/index.ts`, hookName)) ||
      (await checkThePathIsCorrect(`${tempFilePath}/index.tsx`, hookName));
  }

  return finalFilePath;
};

/** 扫描文件中的所有 import */
const analyzeImportsInTheFile = (content: string): { [k: string]: string } => {
  const sourceFile = ts.createSourceFile(
    'tempFile.ts',
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const imports: Array<{
    module: string;
    importedElements: string[];
  }> = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const module = node.moduleSpecifier.text;
      const importedElements: string[] = [];
      const importClause = node.importClause;

      if (importClause) {
        if (importClause.name) {
          importedElements.push(importClause.name.text);
        }

        if (importClause.namedBindings) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            // Namespace import, e.g., * as name
            importedElements.push('*');
          } else if (ts.isNamedImports(importClause.namedBindings)) {
            // Named imports
            importClause.namedBindings.elements.forEach((element) => {
              importedElements.push(element.name.text);
            });
          }
        }
      }

      imports.push({ module, importedElements });
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);

  const finalImports: { [k: string]: string } = {};

  imports.forEach((importObj) => {
    importObj.importedElements.forEach((importedElement) => {
      finalImports[importedElement] = importObj.module;
    });
  });

  return finalImports;
};

/** 扫描组件中所使用的子组件、hook */
const analyzeComponentsAndImportsInTheComponent = (content: string) => {
  const sourceFile = ts.createSourceFile(
    'tempFile.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  let usedComponents: Set<string> = new Set();
  let usedHooks: Set<string> = new Set();

  const visit = (node: ts.Node) => {
    // 检查 JSX 元素
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName;
      processTagName(tagName);
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      processTagName(tagName);
    }

    // 检查 Hook 调用
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const functionName = node.expression.text;
      if (/^use[A-Z].*/.test(functionName)) {
        usedHooks.add(functionName);
      }
    }

    ts.forEachChild(node, visit);
  };

  const processTagName = (tagName: ts.Node) => {
    let componentName = '';

    if (ts.isIdentifier(tagName)) {
      componentName = tagName.text;
    } else if (ts.isPropertyAccessExpression(tagName)) {
      componentName = tagName.name.text;
    }

    if (componentName && /^[A-Z].*/.test(componentName)) {
      usedComponents.add(componentName);
    }
  };

  visit(sourceFile);

  return {
    components: Array.from(usedComponents),
    hooks: Array.from(usedHooks),
  };
};

/** 入口函数 */
export const analyzeIndexFunction = async (params: {
  filePath: string;
  content?: string;
}): Promise<Array<Import> | undefined> => {
  const { filePath, content = '' } = params;

  if (!filePath) {
    return;
  }

  const scanImportRes: Array<Import> = [];

  const fileContent = await readFileAsync(filePath, 'utf-8');

  const { components, hooks } = analyzeComponentsAndImportsInTheComponent(
    content || fileContent
  );

  const scanImportMap = analyzeImportsInTheFile(fileContent);

  [...components, ...hooks].forEach((item) => {
    scanImportRes.push({
      import: item,
      path: scanImportMap[item] || '',
    });
  });

  if (scanImportRes.length > 0) {
    for (const importObj of scanImportRes) {
      if (importObj.path.startsWith('.') || importObj.path.startsWith('@/')) {
        const tempImportFilePath = await getImportFilePath(
          filePath,
          importObj.path,
          importObj.import || ''
        );

        importObj.absolutePath = tempImportFilePath;

        importObj.child = await analyzeIndexFunction({
          filePath: tempImportFilePath.split(':')[0],
        });
      }
    }
  }

  return scanImportRes;
};
