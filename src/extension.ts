import * as vscode from 'vscode';

import {
  analyzeIndexFunction,
  formatterAnalyzeData2WebviewData,
  openHtml,
} from './utils';
import { getAbsoluteOriginPathMap } from './utils/analyze/path';

export async function activate(context: vscode.ExtensionContext) {
  const analyzeHooksInTheFile = vscode.commands.registerCommand(
    'reacooree.分析文件内的 hooks 结构',
    async (uri: vscode.Uri) => {
      try {
        const originPathMap = await getAbsoluteOriginPathMap(uri.fsPath);

        const scanImportRes = await analyzeIndexFunction({
          originPathMap,
          filePath: uri.fsPath,
        });

        if (!scanImportRes) {
          vscode.window.showInformationMessage(`Failed`);
        } else {
          openHtml(
            context,
            JSON.stringify(formatterAnalyzeData2WebviewData(scanImportRes))
          );
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error reading file: ${error.message}`);
      }
    }
  );

  const analyzeHooksInTheComponent = vscode.commands.registerCommand(
    'reacooree.分析组件内的 hooks 结构',
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage('No editor is active');
        return;
      }

      const originPathMap = await getAbsoluteOriginPathMap(
        editor.document.uri.fsPath
      );

      const scanImportRes = await analyzeIndexFunction({
        originPathMap,
        filePath: editor.document.uri.fsPath,
        content: editor.document.getText(editor.selection),
      });

      if (!scanImportRes) {
        vscode.window.showInformationMessage(`Failed`);
      } else {
        openHtml(
          context,
          JSON.stringify(formatterAnalyzeData2WebviewData(scanImportRes))
        );
      }
    }
  );

  context.subscriptions.push(analyzeHooksInTheFile);
  context.subscriptions.push(analyzeHooksInTheComponent);
}

export function deactivate() {}
