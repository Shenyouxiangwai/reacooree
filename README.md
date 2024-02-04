# Reacooree

## 更新

v0.0.1 春节快乐！

v0.0.2
- `new` 现在可以在 setting 文件里面修改 @ 路径所对应的目录，默认为 /src
- `new` 现在可以在 setting 文件里面修改想要忽略的 Components 与 Hooks 的名称，默认为 ["div","p","span","image","View","Text","Image","Provider","useState","useRef","useMemo","useEffect","useCallback","useMemoizedFn","useDidShow","useDidHide"]
- `new` 现在可以在结果页中进行搜索操作，搜索结果会高亮显示
- `new` 现在可以在结果页中点击筛选按钮，以筛选出未被忽略的 Components 与 Hooks
- `change` 现在右键点击节点会直接跳转到变量被声明所在的行数

## 介绍

这是一款可以分析您的 React 组件中所使用的 hooks，并生成树图的工具。

## 使用说明

请全部选中您所需分析的代码（React组件），或在左侧菜单栏中右键点击您所需分析的文件，选择相应的命令，即可在右侧看到分析结果。

在树图中，您可以通过左上角的输入框来搜索你想搜索的 hook 以及组件，右键点击节点可以跳转到相应的文件内。

> 仅支持跳转本地的 hook 以及组件，node_modules 中的跳转正在开发中。

**春节快乐！**
