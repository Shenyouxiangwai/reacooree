import * as vscode from 'vscode';
import { Import } from '../analyze';

type WebviewData = {
  name: string;
  value: string;
  absolutePath: string;
  collapsed: boolean;
  children?: Array<WebviewData>;
};

const getNonce = () => {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const getWebviewContent = (content: string) => {
  const nonce = getNonce();

  return `<!DOCTYPE html>
  <html lang="en" style="height: 100%">
  
  <head>
    <meta charset="utf-8">
  </head>
  
  <script nonce="${nonce}" type="text/javascript" src="https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js"></script>
  <script nonce="${nonce}" type="text/javascript"
    src="https://registry.npmmirror.com/echarts/5.4.3/files/dist/echarts.min.js"></script>
  
  <body style="height: 100%; margin: 0; padding: 0; background: white">
    <div style="position: fixed; left: 20px; top: 20px; z-index: 1; display: flex; align-items: center;">
      <input type="text" id="searchInput" placeholder="Search node..." onkeyup="handleEnter(event)"
        style="height: 36px; box-sizing: border-box; font-size: 18px; border: 1px solid #bbbbbb; padding: 5px 10px; border-radius: 4px; margin-right: 8px; font-family: monospace;">
      <button onclick="searchNode()"
        style="height: 36px; font-size: 18px; border: 1px solid #bbbbbb; padding: 5px 10px; border-radius: 4px; background: #d63031; color: white; border: none;">搜索</button>
    </div>
  
    <div id="container" style="height: 100%"></div>
  </body>
  
  
  <script nonce="${nonce}" type="text/javascript">
    const vscode = acquireVsCodeApi();
  
    const chart = echarts.init(document.getElementById('container'), null, {
      renderer: 'canvas',
      useDirtyRect: false
    });
  
    const content = ${content}
  
    const openFileDiv = (filePath) => {
      vscode.postMessage({
        command: 'openFile',
        filePath: filePath
      });
    }
  
    chart.showLoading();
  
    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          triggerOn: 'mousemove'
        },
        series: [
          {
            type: 'tree',
            data: [{
              name: 'root',
              children: content,
            }],
            emphasis: {
              focus: 'descendant'
            },
            top: '1%',
            left: '7%',
            bottom: '1%',
            right: '20%',
            symbolSize: 7,
            label: {
              position: 'bottom',
              verticalAlign: 'middle',
              distance: 20,
              fontSize: 18,
              fontFamily: "monospace",
              rich: {
                keyword: {
                  color: 'white',
                  fontSize: 18,
                  borderRadius: 4,
                  padding: [5, 10, 5, 10],
                  backgroundColor: '#d63031',
                  fontFamily: "monospace",
                },
              }
            },
            leaves: {
              label: {
                position: 'right',
                verticalAlign: 'middle',
                align: 'left'
              }
            },
            emphasis: {
              focus: 'descendant'
            },
            expandAndCollapse: true,
            animationDuration: 550,
            animationDurationUpdate: 750,
            itemStyle: {
              color: '#d63031',
              borderColor: 'white',
              borderWidth: 3
            },
            initialTreeDepth: 0
          }
        ]
      }
    );
  
    chart.hideLoading();
  
    chart.on('contextmenu', (params) => {
      params.event.event.preventDefault();
  
      if (params.data.absolutePath.startsWith('/')) {
        openFileDiv(params.data.absolutePath)
      }
    });
  
    window.addEventListener('resize', chart.resize);
  
    const handleEnter = (event) => {
      if (event.key === 'Enter') {
        searchNode();
  
        event.preventDefault();
      }
    }
  
    const searchNode = () => {
      var input = document.getElementById('searchInput').value;
  
      if (!input) return
  
      const deepCopy = (obj) => {
        var result = Array.isArray(obj) ? [] : {};
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              result[key] = deepCopy(obj[key]);
            } else {
              result[key] = obj[key];
            }
          }
        }
        return result;
      }
  
      const _searchNode = (data, searchKey) => {
        let isFound = false;
        const searchAndUpdate = (node, searchKey, parentNodes = []) => {
          if (node.name === searchKey) {
            if (!isFound) isFound = true
            node.collapsed = false;
            node.name = '{keyword|' + node.name + '}'
            parentNodes.forEach(parentNode => parentNode.collapsed = false);
            return true;
          } else {
            node.collapsed = true;
          }
  
          let found = false;
          if (node.children && node.children.length > 0) {
            for (const childNode of node.children) {
              if (searchAndUpdate(childNode, searchKey, [...parentNodes, node])) {
                found = true;
              }
            }
          }
          return found;
        };
  
        const newData = deepCopy(data);
  
        newData.forEach(node => searchAndUpdate(node, searchKey));
  
        return { isFound, children: newData };
      };
  
      const { isFound, children } = _searchNode(content, input);
  
      chart.setOption({
        series: [{
          data: [{
            name: 'root',
            children,
            collapsed: !isFound
          }]
        }],
      });
    }
  </script>
  
  </html>`;
};

export const formatterAnalyzeData2WebviewData = (analyzeData: Import[]) => {
  return analyzeData.map((item) => {
    // 创建一个新对象，将 import 和 path 属性重命名，并递归处理 child 属性
    const newItem: WebviewData = {
      name: item.import,
      value: item.path,
      absolutePath: item.absolutePath || item.path,
      collapsed: true,
    };

    // 如果存在 child 属性，递归调用 transformArray
    if (item.child) {
      newItem.children = formatterAnalyzeData2WebviewData(item.child);
    }

    return newItem;
  });
};

export const openHtml = (context: vscode.ExtensionContext, content: string) => {
  const panel = vscode.window.createWebviewPanel(
    'newTab',
    'Reacooree',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent(content);

  panel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.command) {
        case 'openFile':
          const [filePath, lineNumber] = message.filePath.split(':');

          const position = new vscode.Position(lineNumber - 1, 0);

          vscode.workspace.openTextDocument(filePath).then((doc) => {
            vscode.window.showTextDocument(doc, {
              selection: new vscode.Range(position, position),
            });
          });

          break;
      }
    },
    undefined,
    context.subscriptions
  );
};
