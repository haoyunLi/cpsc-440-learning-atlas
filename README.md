# CPSC 440 Learning Atlas

中文逐步讲解，保留 English statistical terms。静态学习网站覆盖 probability、inference、variance、ANOVA、multiple comparisons、factorial / blocked designs 和 regression。

**学习网站：** https://haoyunli.github.io/cpsc-440-learning-atlas/

10 个学习单元、104 个教学段落、77 道原创改编练习（247 个解题步骤）、10 个章节实验和 7 个交互工作台。另有 20 张原创静态图与 10 组分步图解（共 40 个步骤画面）。每个单元从问题与动机进入定义、计算机制、worked examples、条件、误解与练习，并明确掌握目标。

新增的自学入口：

- [练习工坊](practice.html)：58 道数值题、19 道选择题；按章节、难度、题型与复习状态筛选，自动判题、逐选项解释、常见计算岔路反馈、提示、可逐步推进的解析、每章抽一题综合自测（本轮进度与累计记录分开）。每题附独立 base R 脚本；进度仅保存于本浏览器。每题回到对应知识点；筛选和自测模式与 URL 同步，脚本未就绪时自动判题控件保持禁用。
- [交互实验室](labs.html)：分布与单双尾概率、Welch / pooled / paired 数据工作台、可暂停的 residual / Q–Q 逐点演示、研究问题与设计方法向导，以及可编辑系数、均值与样本量的 contrast 实验（普通 / Bonferroni / Scheffé 区间、正交性与当前设置 R 代码），以及可编辑观测、追踪同一点的变换与均值实验（平方根 / 对数、回变换中心、稳定二阶矩差值、当前数据 R 代码），以及精确秩检验实验（20 个组标签与 32 个符号分配、含 ties 重数与删零、单双侧尾部计数、可暂停播放）。
- [自学手册](handbook.html)：零基础路线、公式符号与分位数读法、11 类方法速查、完整 R 入门分析、结论写法、20 个中英术语检索。
- [辅助资源](resources.html)：按章筛选 OpenIntro 视频与教材、Seeing Theory 可视化、NIST 方法说明和 R 官方文档，每个资源附学习任务。

原有实验包括 binomial / CLT、α / β / power、CI repeated coverage、pairing、variance CI、ANOVA、FWER、interaction、blocking 和 regression intervals。章节还包含连续性校正的完整边界规则与近似误差、median CI 从置信度到数据端点、单样本单侧 t 检验逆求样本量。新增深入例题针对真实难点：不放回概率、单双侧功效、软件秩统计量差异、F 小于 1 的双尾、非平衡 ANOVA、Tukey 字母、interaction 与显著性、block 编码与 influence。

## 内容与来源

依据 Alexander E. Lipka 的 CPSC 440 lecture slides 和相同章节的 class notes，按两套资料的内容并集重新编写。材料范围为 743 slides 与 495 notes pages；这两个计数界定范围，不构成自动的完整性证明。逐页来源对应记录保留在非公开账本中。

课程的重复逐行推导与 SAS/R 软件输出合并成科学解释、代表性演算与不同场景的案例桥接。本站不逐格转载每个软件输出、原课件图片、教材扫描页或原练习题。原始资料、作业、测验、考试和个人答案不包含在此仓库。Notes 中不同于 PPT 的案例和推导分别保留；方法的适用条件优先于原资料中不严谨的措辞。

公开来源说明、各章文件与主题页码映射、primary references 见 [sources.html](sources.html)。作业与测验只作为题型参考，练习的数值和情境重新设计；没有转载个人提交答案。本站为独立学习辅助材料，不是 UIUC 官方课程站。

## 本地运行与维护

无需 npm 或 build service。Python 3：

```sh
python3 -m http.server 4400
```

在浏览器打开 `http://localhost:4400`。教学内容在 `content/part1.json`、`part2.json`、`part3.json`；静态图与分步图解分别在 `content/figures.json`、`content/walkthroughs.json`。修改后运行：

```sh
python3 tools/build.py
```

补充内容在 `content/deepening.json`，来源映射在 `content/coverage.json`，题库在 `content/practice.json`。`tools/build_learning.py` 生成练习、实验、手册和资源页，并为每道题生成 `downloads/*.R`。`tools/r_examples.py` 从章节正文生成 58 个独立 R 示例下载，放在 `downloads/chapters/`；每段代码包含所需数据或课程汇总统计量，SAS 模板不作为 R 下载。R 代码需要在自己的 R 环境运行；浏览器实验使用 JavaScript 数值计算。

Ch06 新例题将带 ties 的条件精确分布、continuity correction、零差处理以及 R / SAS 统计量定义连起来；小样本枚举兼容 R 4.4.1，明确与 R-devel 文档的版本差异。Ch09 逐对计算不等 n 的 LSD / Tukey–Kramer SE、区间与 adjusted P；Ch15 新增完整 blocked factorial 推断和缺失单元后可估计的 adjusted contrast。

Ch04 区分单点概率、尾概率与精确二项检验的双侧定义；Ch07 补齐左右尾 / 等尾双侧与匹配区间，并在同一总体 variance 下比较不同分布的实际错误率及 Monte Carlo 误差。Ch14 用完整不平衡数据逐步算 Type I / II / III SS 与各自假设；Ch15 分开重拟合 MSE 比值与课程规划 RE，核对自由度和整数重复数。

Ch06 补齐等组、不等分配和 paired 样本量规划，取整后重新核验实际 t power，并用ρ敏感性分析说明差值 SD 的规划依据。Ch08 区分变换后中心、回变换 estimand 与原尺度 arithmetic mean；Ch11 用 coefficient covariance 连起系数 CI、mean CI 和 PI，并提供 correlation bias 的独立模拟与 MCSE。

Ch09 包含单个 contrast 的单双侧、正交 SS 分解、Scheffé 与 Dunnett 联合 t 积分的完整计算。Ch14/15 的补充例题覆盖 simple effects 的预定 family、完整 cell 的 Brown–Forsythe、16 个观测的 Latin square 与 random-block 均值/差值 SE。

生成的 HTML 已提交，GitHub Pages 从 `main` 根目录发布。JavaScript 关闭时仍可阅读所有核心内容、展开提示与解析。运行时不依赖 CDN、外部字体或服务器 API；外部辅助链接需要网络。

## 验证

数值实现与 R 的 primary implementation 进行 459 项独立对照：normal、t、χ²、F、binomial、OLS 和 ANOVA。Normal quantile 允许 3×10⁻⁶ 误差；其他分布按各项更严格的 tolerance 核查。安装 R 后运行：

```sh
node tests/numerical.mjs
node tests/workbench.mjs
node tests/two_sample_plot.mjs
node tests/ranks.mjs
node tests/ranks_lifecycle.mjs
node tests/inference.mjs
node tests/summary.mjs
node tests/transformation.mjs
node tests/progress.mjs
node tests/contrasts.mjs
node tests/learning.mjs
python3 tests/site.py
python3 tests/practice_paths.py
python3 tests/r_examples.py
```

工作台数值测试独立对照 R，包括极小尾概率、无效输入、接近数值精度的常量数据与配对约束。推断实验还检查单侧 / 双侧模型中原假设与备择的分类，只有真值满足备择时才将不拒绝概率称为 β。77 道题、58 个章节示例及 R 入门脚本，共 136 个下载脚本在独立、干净的 R 会话中执行，警告也视为失败；判题测试覆盖空输入、错误格式、容差、整数要求。结构测试检查所有页面内部链接、搜索锚点、来源覆盖和静态题目。

数据摘要实验保留微小数值尺度，用明确标注的坐标基准处理大数附近的微小差异；常量数据的 SD/variance 正确为零。CI 重复覆盖明确为独立的双侧已知 σ 演示，说明它与单侧检验界限的区别。

精确秩实验的全部 20 个标签分配和 32 个符号分配与独立 R 枚举逐项一致；动画测试覆盖模式 / 尾部规则切换、末项停止、减少动态、离屏暂停，以及表格焦点与分配按钮节点稳定性。两样本绘图验证正比例换单位与平移后几何位置一致，小数数据不会被固定留白压扁；原始单位与显示刻度关系在图下说明。

变换实验用 23 组独立 R 对照核验；近常数平方根数据用有理化差值计算二阶矩，避免把浮点抵消当作教学差异；对数差值不可分辨时明确提示。隔离进度测试覆盖错误 JSON 形状、重复/未知章节、无效练习字段、有效记录保留和搜索加载失败；浏览器测试使用独立端口，避免改动用户已有进度。

浏览器验证覆盖桌面与手机布局、做错→待复习→重新答对、保存进度、综合自测、术语搜索、实验参数与动画。原有章节还检查了 interval 播放/暂停/重置、配对 covariance、设计平衡、prediction interval 宽度、输入错误、搜索与内部链接。浏览器字体、自定义辅助技术组合仍可能需要使用者反馈。

新增分步图解也验证了手动前后推进、键盘 Enter、播放/暂停、离屏停止、最终步骤停止、减少动态偏好、加载失败和全部章节的无 JavaScript 回退。手机默认显示完整图，放大图的方向键移动和当前步骤同步已逐章核查。

设计规则见 [DESIGN.md](DESIGN.md)。字体许可见 [FONT-LICENSE.md](assets/FONT-LICENSE.md)。
