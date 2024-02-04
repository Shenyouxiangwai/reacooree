import * as vscode from 'vscode';
import { Import } from '../analyze';

type WebviewData = {
  name: string;
  value: string;
  absolutePath: string;
  collapsed: boolean;
  children?: Array<WebviewData>;
};

const ignores = JSON.stringify(
  vscode.workspace.getConfiguration().get('Reacooree.ignores')
);

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
      <input type="text" id="searchInput" placeholder="Search node..." onkeyup="handleEnter(event)" class="input">
      <button onclick="searchNode()" class="button">搜索</button>
  
      <text style="margin-right: 8px;">是否过滤</text>
      <label class="switch">
        <input type="checkbox" id="switch">
        <span class="slider"></span>
      </label>
    </div>
  
    <div id="container" style="height: 100%"></div>
  </body>
  
  <style>
    .input {
      height: 36px;
      box-sizing: border-box;
      font-size: 18px;
      border: 1px solid #bbbbbb;
      padding: 5px 10px;
      border-radius: 4px;
      margin-right: 8px;
      font-family: monospace;
    }
  
    .button {
      height: 36px;
      font-size: 18px;
      border: 1px solid #bbbbbb;
      padding: 5px 10px;
      border-radius: 4px;
      background: #d63031;
      color: white;
      margin-right: 8px;
      border: none;
    }
  
    .switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }
  
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
  
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      -webkit-transition: .4s;
      transition: .4s;
      border-radius: 34px;
    }
  
    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      -webkit-transition: .4s;
      transition: .4s;
      border-radius: 50%;
    }
  
    input:checked+.slider {
      background-color: #d63031;
    }
  
    input:focus+.slider {
      box-shadow: 0 0 1px #d63031;
    }
  
    input:checked+.slider:before {
      -webkit-transform: translateX(26px);
      -ms-transform: translateX(26px);
      transform: translateX(26px);
    }
  </style>
  
  <script nonce="${nonce}" type="text/javascript">
    const vscode = acquireVsCodeApi();
  
    const chart = echarts.init(document.getElementById('container'), null, {
      renderer: 'canvas',
      useDirtyRect: false
    });
  
    const content = ${content};
  
    const ignores = ${ignores};
  
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
            initialTreeDepth: 1
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
  
    const filterItems = (items) => {
      const recursiveFilter = (items) => {
        return items
          .filter(item => !ignores.includes(item.name))
          .map(item => {
            if (item.children && item.children.length) {
              item.children = recursiveFilter(item.children);
            }
            return item;
          });
      }
  
      return recursiveFilter(items);
    }
  
    const ignoredContent = filterItems(content);
  
    document.getElementById('switch').addEventListener('change', function () {
      chart.setOption({
        series: [{
          data: [{
            name: 'root',
            children: this.checked ? ignoredContent : content,
          }]
        }],
      });
    });
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
