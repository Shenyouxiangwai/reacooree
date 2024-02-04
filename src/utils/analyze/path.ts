import * as path from 'path';
import * as vscode from 'vscode';

import { checkWhitePathIsCorrect } from './check';

const fs = require('fs').promises;

const absoluteOriginPath = vscode.workspace
  .getConfiguration()
  .get('Reacooree.absoluteOriginPath') as string;

/** 获取引入的绝对路径 */
export const getImportFilePath = async (
  filePath: string,
  moduleName: string,
  hookName: string
): Promise<string> => {
  let basicFilePath = '',
    finalFilePath = '';

  /** 判断是绝对路径还是相对路径 -> 获取基础的文件路径 */
  if (moduleName.startsWith('@')) {
    basicFilePath = `${
      filePath.split(absoluteOriginPath)[0] + absoluteOriginPath
    }/${moduleName.split('@/')[1]}`;
  } else {
    basicFilePath = path.resolve(path.dirname(filePath), moduleName);
  }

  if (!(basicFilePath.endsWith('.tsx') || basicFilePath.endsWith('.ts'))) {
    finalFilePath = await checkWhitePathIsCorrect(basicFilePath, hookName);
  } else {
    finalFilePath = basicFilePath;
  }

  return finalFilePath;
};

export const findConfigFiles = async (
  startPath: string,
  filesToFind: Array<string>
) => {
  let currentDir = startPath;

  while (currentDir !== path.parse(currentDir).root) {
    for (let file of filesToFind) {
      const filePath = path.join(currentDir, file);
      try {
        await fs.access(filePath);
        return filePath;
      } catch (error) {}
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
};

const readTsConfigPaths = async (
  tsConfigPath: string
): Promise<Record<string, Array<string>>> => {
  try {
    // 读取 tsconfig.json 文件
    const tsConfigRaw = await fs.readFile(tsConfigPath, 'utf8');
    // 解析 JSON 内容
    const tsConfig = JSON.parse(tsConfigRaw);

    // 检查 compilerOptions 和 paths 是否存在
    if (tsConfig.compilerOptions && tsConfig.compilerOptions.paths) {
      return tsConfig.compilerOptions.paths;
    } else {
      throw new Error('Paths are not defined in tsconfig.json');
    }
  } catch (error) {
    console.error('Error reading tsconfig paths:', error);
    throw error; // 重新抛出错误，以便调用者可以处理它
  }
};

export const getAbsoluteOriginPathMap = async (
  filePath: string
): Promise<Record<string, Array<string>>> => {
  const startPath = filePath;
  const filesToFind = ['tsconfig.json', 'webpack.config.json'];

  const foundPath = await findConfigFiles(startPath, filesToFind);
  if (foundPath) {
    return await readTsConfigPaths(foundPath);
  } else {
    return { '*': ['/src'] };
  }
};
