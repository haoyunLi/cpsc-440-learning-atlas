# CPSC 440 Learning Atlas

中文逐步讲解，保留 English statistical terms。静态学习网站覆盖 probability、inference、variance、ANOVA、multiple comparisons、factorial / blocked designs 和 regression。

**学习网站：** https://haoyunli.github.io/cpsc-440-learning-atlas/

10 个学习单元、78 个教学段落、10 个交互实验，另有 20 张原创静态图与 10 组分步图解（共 40 个步骤画面）。所有单元的讲解、例题与答案已逐章重写，补足计算衔接与变量解释。每个单元从问题与动机进入定义、计算机制、worked examples、条件、误解与解释式练习。交互包括 binomial / CLT、α / β / power、CI repeated coverage、pairing、variance CI、ANOVA、FWER、interaction、blocking 和 regression intervals。

## 内容与来源

依据 Alexander E. Lipka 的 CPSC 440 lecture slides 和相同章节的 class notes，按两套资料的内容并集重新编写。材料范围为 743 slides 与 495 notes pages；这两个计数界定范围，不构成自动的完整性证明。逐页来源对应记录保留在非公开账本中。

课程的重复逐行推导与 SAS/R 软件输出合并成科学解释、代表性演算与不同场景的案例桥接。本站不逐格转载每个软件输出、原课件图片、教材扫描页或原练习题。原始资料、作业、测验、考试和个人答案不包含在此仓库。Notes 中不同于 PPT 的案例和推导分别保留；方法的适用条件优先于原资料中不严谨的措辞。

公开来源说明与 primary references 见 [sources.html](sources.html)。本站为独立学习辅助材料，不是 UIUC 官方课程站。

## 本地运行与维护

无需 npm 或 build service。Python 3：

```sh
python3 -m http.server 4400
```

在浏览器打开 `http://localhost:4400`。教学内容在 `content/part1.json`、`part2.json`、`part3.json`；静态图与分步图解分别在 `content/figures.json`、`content/walkthroughs.json`。修改后运行：

```sh
python3 tools/build.py
```

生成的 HTML 已提交，GitHub Pages 从 `main` 根目录发布。JavaScript 关闭时仍可阅读所有核心内容。

## 验证

数值实现与 R 的 primary implementation 进行 459 项独立对照：normal、t、χ²、F、binomial、OLS 和 ANOVA。Normal quantile 允许 3×10⁻⁶ 误差；其他分布按各项更严格的 tolerance 核查。安装 R 后运行：

```sh
node tests/numerical.mjs
```

另外检查了所有章节在 1440、390、320px 下的横向溢出与参数端点，以及 interval 播放/暂停/重置、配对 covariance、设计平衡、prediction interval 宽度、输入错误、进度、搜索、可访问名称与内部链接。测试采用独立 headless browser；未操作原生桌面界面。浏览器字体、自定义辅助技术组合仍可能需要使用者反馈。

新增分步图解也验证了手动前后推进、键盘 Enter、播放/暂停、离屏停止、最终步骤停止、减少动态偏好、加载失败和全部章节的无 JavaScript 回退。手机默认显示完整图，放大图的方向键移动和当前步骤同步已逐章核查。

设计规则见 [DESIGN.md](DESIGN.md)。字体许可见 [FONT-LICENSE.md](assets/FONT-LICENSE.md)。
