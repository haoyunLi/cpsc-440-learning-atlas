# CPSC 440 Learning Atlas

中文逐步讲解，保留 English statistical terms。静态学习网站覆盖 probability、inference、variance、ANOVA、multiple comparisons、factorial / blocked designs 和 regression。

**学习网站：** https://haoyunli.github.io/cpsc-440-learning-atlas/

10 个学习单元、104 个教学段落、91 道原创改编练习（304 个解题步骤）、十章的交互实验和 8 个交互工作台。另有 20 张原创静态图与 10 组分步图解（共 40 个步骤画面）。每个单元从问题与动机进入定义、计算机制、worked examples、条件、误解与练习，并明确掌握目标。

新增的自学入口：

- [练习工坊](practice.html)：63 道数值题、28 道选择题；按章节、难度、题型与复习状态筛选，自动判题、逐选项解释、常见计算岔路反馈、提示、可逐步推进的解析、每章抽一题综合自测（本轮进度与累计记录分开）。每题附独立 base R 脚本；进度仅保存于本浏览器。每题回到对应知识点，61 个知识点也直接列出相应题目；各节提供下一节或章节实验与返回目录入口；筛选和自测模式与 URL 同步，脚本未就绪时自动判题控件保持禁用。
- [交互实验室](labs.html)：分布与单双尾概率、Welch / pooled / paired 数据工作台、可暂停的 residual / Q–Q 逐点演示、研究问题与设计方法向导，以及可编辑系数、均值与样本量的 contrast 实验（普通 / Bonferroni / Scheffé 区间、正交性与当前设置 R 代码），以及可编辑观测、追踪同一点的变换与均值实验（平方根 / 对数、回变换中心、稳定二阶矩差值、当前数据 R 代码），以及精确秩检验实验（20 个组标签与 32 个符号分配、含 ties 重数与删零、单双侧尾部计数、可暂停播放），以及可编辑六格频数的条件概率实验（行 / 列条件、边际与联合概率、有限表独立性、面积图和当前表的 R 代码）。
- [自学手册](handbook.html)：零基础路线、公式符号与分位数读法、14 类问题与设计速查、完整 R 入门分析、结论写法、20 个中英术语检索。
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

补充内容在 `content/deepening.json`，来源映射在 `content/coverage.json`，题库在 `content/practice.json`。`tools/build_learning.py` 生成练习、实验、手册和资源页，并为每道题生成 `downloads/*.R`。`tools/r_examples.py` 从章节正文生成 77 个独立 R 示例下载，放在 `downloads/chapters/`；每段代码包含所需数据或课程汇总统计量，SAS 模板不作为 R 下载。R 代码需要在自己的 R 环境运行；浏览器实验使用 JavaScript 数值计算。

Ch04 通过完整列联表区分两种条件方向、joint 与 marginals，以及固定清单概率和样本频率；Ch05 对照 PPT 的 σ 与 notes 的样本 s 设定，分别说明精确 z、正态模型 t 与大样本 z 近似。方法向导保留配对 / 重复 / block 结构与 variance 条件，推荐对应知识点；Ch08 追加三项 Welch 检验、Bonferroni P 与近似同时区间的完整复算。

Ch06 新例题将带 ties 的条件精确分布、continuity correction、零差处理以及 R / SAS 统计量定义连起来；小样本枚举兼容 R 4.4.1，明确与 R-devel 文档的版本差异。Ch09 逐对计算不等 n 的 LSD / Tukey–Kramer SE、区间与 adjusted P；Ch15 新增完整 blocked factorial 推断和缺失单元后可估计的 adjusted contrast。

Ch04 区分单点概率、尾概率与精确二项检验的双侧定义；Ch07 补齐左右尾 / 等尾双侧与匹配区间，并在同一总体 variance 下比较不同分布的实际错误率及 Monte Carlo 误差。Ch14 用完整不平衡数据逐步算 Type I / II / III SS 与各自假设；Ch15 分开重拟合 MSE 比值与课程规划 RE，核对自由度和整数重复数。

Ch06 补齐等组、不等分配和 paired 样本量规划，取整后重新核验实际 t power，并用ρ敏感性分析说明差值 SD 的规划依据。Ch08 区分变换后中心、回变换 estimand 与原尺度 arithmetic mean；Ch11 用 coefficient covariance 连起系数 CI、mean CI 和 PI，并提供 correlation bias 的独立模拟与 MCSE。

Ch09 包含单个 contrast 的单双侧、正交 SS 分解、Scheffé 与 Dunnett 联合 t 积分的完整计算。Ch14/15 的补充例题覆盖 simple effects 的预定 family、完整 cell 的 Brown–Forsythe、16 个观测的 Latin square 与 random-block 均值/差值 SE。

生成的 HTML 已提交，GitHub Pages 从 `main` 根目录发布。JavaScript 关闭时仍可阅读所有核心内容、展开提示与解析。运行时不依赖 CDN、外部字体或服务器 API；外部辅助链接需要网络。

## 验证

数值实现与 R 的 primary implementation 进行 459 项独立对照：normal、t、χ²、F、binomial、OLS 和 ANOVA。Normal quantile 允许 3×10⁻⁶ 误差；其他分布按各项更严格的 tolerance 核查。安装 R 后运行：

```sh
node tests/numerical.mjs
node tests/chapter_probabilities.mjs
node tests/clt.mjs
node tests/factorial.mjs
node tests/kruskal.mjs
node tests/influence.mjs
node tests/latin.mjs
node tests/randomization.mjs
node tests/student.mjs
node tests/paired.mjs
node tests/anova.mjs
node tests/ci_geometry.mjs
node tests/distribution_display.mjs
node tests/search.mjs
node tests/learning_storage.mjs
node tests/answer_feedback.mjs
node tests/brown_forsythe.mjs
node tests/workbench.mjs
node tests/chooser.mjs
node tests/conditional.mjs
node tests/conditional_rendering.mjs
node tests/two_sample_plot.mjs
node tests/ranks.mjs
node tests/ranks_lifecycle.mjs
node tests/inference.mjs
node tests/summary.mjs
node tests/boxplot.mjs
node tests/variance_display.mjs
node tests/transformation.mjs
node tests/progress.mjs
node tests/contrasts.mjs
node tests/learning.mjs
python3 tests/site.py
python3 tests/practice_paths.py
python3 tests/r_examples.py
```

工作台数值测试独立对照 R，包括极小尾概率、无效输入、接近数值精度的常量数据与配对约束。推断实验还检查单侧 / 双侧模型中原假设与备择的分类，只有真值满足备择时才将不拒绝概率称为 β。91 道题、77 个章节示例及 R 入门脚本，共 169 个下载脚本在独立、干净的 R 会话中执行，警告也视为失败；判题测试覆盖空输入、错误格式、容差、整数要求。结构测试检查所有页面内部链接、搜索锚点、来源覆盖和静态题目。

Ch08 的 Kruskal–Wallis 实验可编辑三组各3个观测，追踪 pooled ranks、ties correction 与全部1680种固定组规模标签分配；逐项浏览保留观测身份和重复统计量的分配重数，比较χ²近似与条件exact P。正文与新练习包含完整独立R枚举。Ch15 区分block内随机化、全场CRD分配和对既有RCBD数据省略block的分析，并核对两个随机化空间的大小。

Ch14 的四格实验同时展示 cell means、样本构成、raw/equal marginal means 与各加权项；只改变样本数时条件关系保持不变，并可复制当前汇总的 base R 代码。正文用完整 2×2×2 例题从 conditional AB 算到 ABC 的 SE、CI、F 与 P，另区分等权与预定目标构成。Ch11 对照 quadratic 整体 F、增加二次项 F 与 lack-of-fit F 的零假设、分母和 df，并说明 polynomial coefficient 与局部变化率的区别。

数据摘要实验保留微小数值尺度，用明确标注的坐标基准处理大数附近的微小差异；常量数据的 SD/variance 正确为零。CI 重复覆盖明确为独立的双侧已知 σ 演示，说明它与单侧检验界限的区别。

Ch15 的 Latin square 任务可从空表构建、修复“仅每行正确”的错误排列，并逐项查看行序、列序与处理名称的合法随机置换。当前排列可复制为独立 R 检查；结构合法不代替随机化与模型条件。另在 Ch01、05、09 加入先选图形、从研究句子写假设、从等权比较写 contrast 的情境自检，避免只会代入已给公式。

Latin square 检查覆盖全部 576 个四阶合法方阵、9,216 个单格错误、1,000 个可复现置换及 13 个独立 R 排列。桌面和手机检查构建、诊断、随机化与当前 R 复制；RCBD 控件变化保留 Latin square 的编辑状态。CI 动画按最新区间的完整端点扩展坐标范围，避免远端被裁切；分布工作台为密度轴保留可区分刻度，并说明浮点下溢与真实零概率的区别。

二项分布与 ANOVA 章节实验保留极小正概率，接近 1 的二项概率显示小的补事件；F 右尾直接计算，避免用 1−CDF 相减丢失精度。225 个额外 R 对照使用相对误差检查，包括 10⁻¹²⁰ 的尾概率。手册解释科学记数法，秩和讲解区分固定偏移与 ties 下可达的最小秩和。

首页搜索优先显示标题命中，报告匹配总数并支持继续显示全部结果；练习保存前合并最新记录，其他标签页同步累计状态，不重置当前输入、解析或本轮自测。

条件概率实验通过 36 个独立 R 对照，检查空事件条件概率未定义、极端非零概率不显示为0，以及当前表的 R 代码。面积图还穷举 8,736 个状态，核验 joint 与条件集合的面积；向导覆盖 180 个设置组合和设计 / 方差条件切换。

精确秩实验的全部 20 个标签分配和 32 个符号分配与独立 R 枚举逐项一致；动画测试覆盖模式 / 尾部规则切换、末项停止、减少动态、离屏暂停，以及表格焦点与分配按钮节点稳定性。两样本绘图验证正比例换单位与平移后几何位置一致，小数数据不会被固定留白压扁；原始单位与显示刻度关系在图下说明。

变换实验用 23 组独立 R 对照核验；近常数平方根数据用有理化差值计算二阶矩，避免把浮点抵消当作教学差异；对数差值不可分辨时明确提示。隔离进度测试覆盖错误 JSON 形状、重复/未知章节、无效练习字段、有效记录保留和搜索加载失败；浏览器测试使用独立端口，避免改动用户已有进度。

浏览器验证覆盖桌面与手机布局、做错→待复习→重新答对、保存进度、综合自测、术语搜索、实验参数与动画。原有章节还检查了 interval 播放/暂停/重置、配对 covariance、设计平衡、prediction interval 宽度、输入错误、搜索与内部链接。浏览器字体、自定义辅助技术组合仍可能需要使用者反馈。

新增分步图解也验证了手动前后推进、键盘 Enter、播放/暂停、离屏停止、最终步骤停止、减少动态偏好、加载失败和全部章节的无 JavaScript 回退。手机默认显示完整图，放大图的方向键移动和当前步骤同步已逐章核查。

设计规则见 [DESIGN.md](DESIGN.md)。字体许可见 [FONT-LICENSE.md](assets/FONT-LICENSE.md)。

Ch01 的摘要实验用同一数据联动 histogram 与 box plot，显示内围栏、实际须端点和异常候选；可比较 R type 7 与 Tukey hinges，并复制当前数据与规则的 R 复算代码。静态自检保留规则差异的手算解释。Ch11 新增预定方向与观测 slope 相反时的 coefficient 输出解读和右尾练习；p05-07 明确删零符号检验的条件模型，说明它与任意带质量点总体的 median 假设不同。Ch07 的 χ² 密度图按间距保留可区分的刻度。

箱线图对照 104 组独立 R 结果，并执行 104 份当前设置代码绘图；几何检查覆盖所有原始点、须、围栏与箱边，包括常量、微小尺度与大基准值。Variance 刻度检查覆盖 n=4–100。新增回归题在独立测试端口验证错误方向反馈、正确判题和分步解析，避免改动原网站学习记录。

Ch04 以每组 n、重复组数 B 和累计原始数 nB 区分一次均值与模拟次数；新增固定 n 增加 B 的 SE 自检及独立 R 模拟。Ch14 追加完整 factorial 模型下的 main-effect Tukey 例题，说明 br/ar、MSE、error df 与等权 marginal estimand，并对照错误省略另一因素的分析。练习同步修正正态功效规划的条件、变换后比值的点估计措辞和 ANOVA 证据结论。

CLT 实验现可逐组追踪原始点、求和、均值与累积直方图，并复制当前组的完整 R 核对代码。验证包含 n=1–100、独立整数随机序列对照、单步/批量等价、3000 组上限的剩余批次、B=1 时经验 SD 未定义、重置/切 n/复制生命周期与 binomial 控件相互独立。桌面和手机实测单组、批量、最后99组补齐、全部数值列表及 R 复制。

Ch06 新增 pooled / Welch 的长期校准比较：在相等总体均值下交叉改变 n 与 SD，用四个独立正态模拟场景对照拒绝率及 MCSE；同时解释期望 SE² 的权重和 c-based df 的代数对应。Ch07 新增可编辑 Brown–Forsythe 实验，联动原始观测、本组 median、绝对偏差与 Z 的 ANOVA，支持整组平移、围绕中心放大和当前 R 代码。新增两题分别检验误报率解释和位置/散布的区别。

练习答案修改后会撤下旧的正确/错误反馈并提示重新检查，历史明确标为上次有效提交；只有再次提交才累计次数。反馈生命周期测试覆盖数值题、选择题、无效输入、重复编辑、Enter 后移开焦点、跨标签同步和综合自测重置。

Brown–Forsythe 验证包含 16 组独立 R 分析及对应当前数据代码，覆盖不等 n、ties、每组两个值、常量、极小尺度和大基准值；另检查平移/放大、全部点的有限 SVG 坐标、表格焦点、无效输入恢复与异步复制。桌面与 390px 手机实测两个变换、逐行追踪和复制；数值过于接近浮点下限或变换会抹掉组内差异时，会明确提示换单位并保留可用数据。

Ch04 补全 factorial / combination 的计数依据，用12种有序抽法到6个集合解释为什么除以k!，并连回精确标签分配与设计空间。新增期望先修从概率加权定义、八个不等成功率结果，到依赖与独立indicator的均值/方差对照，帮助区分期望可加性和二项分布条件。Ch14 增加多水平slice的完整联合F、共享完整模型误差及预定family校正，并按原课件修正Group因素标签。

Ch15 新实验固定15个花盆的ID、位置与环境，分别按全场CRD或block内RCBD抽签；展示处理×block计数、平均环境和偶然平衡的CRD。当前分配可复制到R核验，草稿与已应用设置明确区分；独立枚举756756个CRD布局与7776个RCBD布局，并核对16份实际分配的R代码。

Ch11 的影响度实验保留六个固定ID，可独立调整第6点的x/y并选择任意点，联动完整拟合、暂时不含选中点的敏感性线、raw residual、leverage及Cook’s D。三种预设区分高leverage在线点、高leverage偏离点与普通x处大残差；当前数据可复制到R。正文从全部原始x上的拟合变化推导Cook的尺度，保留完整模型MSE，并解释零Cook不意味着SE不变。两道新练习分别检验完整计算与估计精度的解释。

影响度核验包含12组数据×全部六种选点，对照R的系数、全部行h/e/D与敏感性预测；另遍历181个合法x步长、5个代表y与六种选点，检查同一坐标下的点、残差和线段。桌面与390px手机实测预设切换、无效输入恢复、键盘调节、稳定选点、放大与R复制；新题验证错误反馈与正确判题。

Ch01 用40名志愿者的完整情景区分目标总体、样本、实验单位、参数与统计量，以及 random assignment 和 random sampling；四种有序样本枚举解释 n−1 的无偏性质与 SD 的偏差。Ch05 增加同一份原始数据的 z-with-s / t 对照，明确中心 t 的零假设条件及复合零假设下 α 的上界含义。新的三种区间实验保留实际生成的 iid 正态样本，允许切换置信水平后重算同一批数据、回看任意已抽样本，并将有限模拟覆盖率与精确理论覆盖率分列。R 导出复现当前选中样本，不声称重建浏览器的随机序列。

三种区间实验用 144 个 n/置信水平组合、34 组原始样本及实际导出脚本与 R 对照；检查单步与批量抽样一致、切换水平不消耗随机序列、重置重放、500 组上限、完整端点、无效状态恢复及复制反馈。桌面与390px手机验证同一数据重算、旧样本回看、R复制和新旧CI实验的独立状态。

Ch06 明确 paired 可以是同一个体的重复观测，也可以是设计中预先匹配的不同单位；用课程 split-field 案例区分 field 作为 pair/block 与 half-field 作为处理随机化实验单位。配对实验与正文共用五对原始值，逐项显示差值、sample covariance 和差值方差贡献；整行反序保持推断，单独反转 B 显示错配身份及算术后果，不输出该映射的正式 P/CI。方法向导、手册与两道练习的设计解释同步修正。

配对实验对三种映射与五个选中 ID 逐一执行独立 R 核验及导出代码；检查原始点坐标固定、身份追踪、整行排序不变量、错配中的单个保留 pair、稳定焦点、错误恢复与复制生命周期。桌面与390px手机验证全部模式、行追踪、放大图及横向表格；169 个独立 R 下载脚本仍全部通过。

Ch08 从“每组 sample variance 的加权合并”推导 MSE，并在等 n 时用 n×组均值的 sample variance 解释 MStrt；明确零假设约束总体 means，不能要求每次样本 means 完全相等。正文区分真实 error 与 fitted residual，以及零和参数化的等权 baseline 和总SS的加权 grand mean。ANOVA 实验与正文共用 A=[4,5,6]、B=[7,8,9]、C=[10,11,12]，逐个观测展示带方向的偏差、交叉项、平方和与完整 ANOVA 表；滑块调整构造样本，不声称进行零假设下的随机模拟。

ANOVA 实验独立对照 R 核验全部500组合法滑块设置，逐点验证总偏差、组间偏差、残差、平方与交叉项；对小 P 使用相对误差。500×9 个选中状态核对坐标与有向箭头，短段箭头不超出本段；14份实际导出R也执行检查。全部169个独立R下载脚本（77个章节示例）通过。
