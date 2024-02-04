import * as fs from 'fs';
import ts from 'typescript';
import { promisify } from 'util';

import { getImportFilePath } from './path';

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
  originPathMap: Record<string, Array<string>>;
  filePath: string;
  content?: string;
}): Promise<Array<Import> | undefined> => {
  const { originPathMap, filePath, content = '' } = params;

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
          originPathMap,
          filePath: tempImportFilePath.split(':')[0],
        });
      }
    }
  }

  return scanImportRes;
};
