# SumatraPDF Mica 主界面预览版

这是非官方便携版。解压后运行同目录的 SumatraPDF.exe，无需安装开发工具。

- 保留原来的顶部标签和窗口按钮，不新增 Windows 标题栏。
- 云母覆盖标签栏、工具栏、书签侧栏背景和文档外围空白；当前标签以蓝色下划线标示。
- PDF 页面和页面缩略图按矩形边界保持不透明，页面内与界面同色的内容也不会被透明化。
- 默认跟随系统深浅主题，文档保持原始颜色。
- 需要 Windows 11 22H2 或更新版本。高对比度、全屏、演示模式以及不支持云母的系统使用实色背景；系统关闭透明效果时云母可能呈现实色。
- 设置 → 高级选项中的 UseMica = false 可以关闭效果。
- 关闭官方自动更新，防止定制版本被原版替换。请保留独立目录中的设置文件。

源码：https://github.com/Guany725/sumatrapdf/tree/mica-modern-ui

仓库通过 mica/modern-ui.patch 保存实际修改，云端编译前应用。SOURCE-COMMIT.txt 记录版本；同次编译提供已应用补丁的匹配源码包。许可及作者信息见 COPYING、COPYING.BSD 和 AUTHORS。
