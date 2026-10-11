# 四场景眼动研究：运行、质量控制与研究就绪状态

更新：2026-10-04；程序 `pilot-2.6.0`，JSON schema `3.5.0`。

逐项完成情况、修复证据和不能勾选的项目见 [当前验收清单](docs/CHECKLIST.md)。

**当前结论：可以开展技术预实验；尚不能标记为正式验证性研究就绪。** 已补上 Brown 中心测量、被试间分配、关键记录检查和完整分析导出。校准分数、真实角色识别精度、语言材料有效性是不同问题；软件测试不能代替真人验证。

> **精度门槛政策（v2.6 起）：只测量，不拦截。** 校准与 validation 每个 checkpoint 各跑一次，所有数字（中心分数、平均误差、离散度、每点 ROI 百分比、采样率）全量写入数据，但**没有任何分数会中止 session**，也不再提供重校准重试。`brownMinimumScore: 75` 等阈值退化为写进每份数据的**参考比较值**，不是通过条件。
>
> 因此 **`complete: true` 不代表这份数据的追踪质量合格**。判断前必须读 `tracking_quality_gate` 和 `quality.tracking_quality`：那里有 `reference_levels_met`、`lowest_brown_score`、`lowest_validation_hz` 和逐个 checkpoint 的分数。排除低精度 trial 是**分析阶段**用这些数字做的决定，不再是采集阶段的决定。

## 1. 如何启动与分配被试

在本目录运行：

```sh
npm run verify
python3 -m http.server 8765 --bind 127.0.0.1
```

用桌面 Chrome 打开 `http://127.0.0.1:8765/?allocation=1&v=2.6.0`。下一位使用分配表中的下一个编号。无编号的首页显示研究者入口；不要让被试自行选择编号。**完整流程预览**为 `http://127.0.0.1:8765/?allocation=1&mode=preview&v=2.6.0`，不请求摄像头、不执行校准门槛，可播放四视频、八次音频并完成问卷。页面始终标明 preview；下载文件以 `preview-` 开头，`mode=preview`、`gaze_enabled=false`、`complete=false`，成功走完时只标记 `flow_complete=true`。逐项材料预览为 `/preview.html`，本浏览器恢复页为 `/recovery.html`。摄像头需 localhost 或 HTTPS；运行环境必须允许加载该 WebGazer fork 所需模型。

[allocation-roster.csv](allocation-roster.csv) 提供 32 个预分配编号。每次填写匿名 participant_code、实际 session_id 和状态；身份信息另行保管。不要重复使用已发放编号；重测保留原记录并明确关联，剔除及补招规则预先确定。不同电脑共享同一份研究者分配表，浏览器没有中央招募锁。

四个场景编号 A=path-break，B=car-bend，C=painting-crack，D=juice-split：

| List | 视频顺序 |
|---|---|
| 1 | A B D C |
| 2 | B C A D |
| 3 | C D B A |
| 4 | D A C B |

这是 Williams balanced Latin square：每个视频在每个位置出现一次，每个有方向的相邻视频对出现一次。再与 standard/mirrored × 两种首词模式交叉，形成 16 个单元。每位被试两个场景 thick-first、两个 thin-first；完整 16 人分配周期内，每场景的首词与镜像均平衡。**分配平衡不等于完成样本平衡**：退出、失败和缺席后按单元报告人数，不能只检查总人数。生成额外空表可运行 `node scripts/allocation-roster.mjs new-roster.csv 64`，脚本拒绝覆盖已有文件。

## 2. 每个阶段具体做哪些 QC

| 阶段 | 实际实现与记录 | 失败处理／边界 |
|---|---|---|
| 运行前 | `npm run verify` 检查媒体解码、四视频各 4.000 s／96 帧／24 fps、build manifest 中的 SHA-256；浏览器预载全部刺激 | 预载失败不进入任务。修改源文件后审查改动，再 `npm run build` 生成新版本指纹；manifest 不是运行时防篡改机制 |
| 浏览器与同意流程 | 桌面 Chrome、webcam、至少 1280×720；请求全屏；记录浏览器、屏幕、viewport、DPR | 研究者需完成实际知情同意；技术入口不能代替伦理流程 |
| 环境与声音 | 记录视力、眼镜、摄像头、距离、光线方向、耳机类型；完整播放中性词 seven 并作答 | 答错可调整后再试一次，再错停止。该步骤只检验基本可听性，不能证明八段研究音频的自然度 |
| Calibration 训练 | 外围八个位置为一轮、每轮重新随机排序，共五轮（40 次，每次呈现点击一次）；随后中央位置连续点击五次，合计 45 次。新位置先等待 750 ms，点击间隔至少 300 ms；仅接收新鲜且不重复的眼部特征帧，并确认模型样本计数增加；记录坐标、时间、接受／拒绝理由；训练时显示预测点 | 每次重新训练；核对 45 个实际接收的训练样本；关闭全局鼠标移动训练。点击本身不是独立精度验证。外围点按轮次分散，因为同一目标连续点击共享头位与同一次注视，对 120 维 ridge 拟合几乎不增加信息。中央点放在最后是为了复刻 Brown `www/js/calibration.js`（Pt5 在其余八点完成后才出现，随即测量中央）——因此**中央分数偏向中央，不是无偏精度估计；五点 validation 才是**|
| Brown 中心 measurement | 中央 + 注视 5 秒；预测做最近最多 4 点均值、边界限制；最后 50 点执行 Brown `calculatePrecision` 同一算式；保存原预测、平滑点、50 点输入、窗口尺寸和分数 | **不拦截。** 分数、平均误差、离散度全量记录，`pass` 字段仍按 ≥75 标注但不控制流程。75 是本研究的参考比较值，不是 Brown 官方标准；50 点不等于完整 5 秒的所有数据 |
| 无点击 Validation（红点可见） | 五个目标各等待 1 s、采样 2 s；显示同一批原始预测的红点，不另开推理循环；从未平滑的原始坐标重算误差、偏移、MAD、频率；每点 ≥50% 落在 200 CSS px 内，且 ≥15 Hz | **不拦截，不重试。** 每点的 ROI 百分比、偏移、MAD、Hz 和失败原因全量记录；切页／失焦／改窗口照样标记为未达参考条件，但不中止。结束后显示实测分数并继续下一阶段 |
| 每次词前 fixation | 1 s X；取后 80% 样本估计 x/y 中位偏移和 MAD；偏移不得超过 min(200 px, 两角色距离/2)，MAD ≤75 px，≥15 Hz | 不通过则不应用偏移校正；原始值保留。校正只平移 AOI，不把失败数据强行修成通过 |
| 视频 | 原生 `playing/ended/waiting/stalled/error`、performance 时间、帧回调、丢帧计数；`ended` 结束 trial，不额外加 405 ms | 播放拒绝、错误、超时或时长不符停止；缓冲、丢帧、墙钟时长偏离一帧记为 QC 标记。媒体 4 s 不等于设备必然精确显示 4 s |
| 图片＋音频注视 | 从首次 `playing` 开始记录 3 s；保存实际词、音频文件、播放事件、时长、是否 ended；记录 raw gaze、时间、viewport、AOI 和打断事件 | 启动失败、10 s 未开始或 3 s 内未播放完则停止；缓冲等使分析 QC 不通过。`playing` 是软件事件，不是已测量的耳机声学起点 |
| 问题回答 | 记录完整题干、显示选项及顺序、选择的 distal/proximal、RT、condition、probe_id、场景位置和作答期间 raw gaze | 回答与 gaze 可按 probe_id 精确连接；问题页面没有物体 AOI，不将选项位置当作视频角色 AOI |
| 结尾问卷 | Age、English background（native／near-native／additional language）、Major、Suggestions；lighting、calibration clarity、video naturalness、audio difficulty 四项各 1–7 | audio difficulty 保持负向措辞；仅凭此题不能认定注意力通过／失败。开头光照另存 lighting_setup，结尾存 lighting |
| 中点与结束 | 两个视频后重复 Brown＋Validation，中点可重校；最后再测一次并保存末端质量 | 末端失败明确记录，不追溯性地把之前样本判为准确 |
| 保存与完整性 | UUID、logical_id、开始／结束／分支 ledger；检查缺行、重复行、无开始或结束的行、session 不符、关键字段缺失、无效或逆序 gaze | `complete` 要求流程未停止且阶段记录、字段对应及连续采样完整性检查均通过。`complete=true` 仍不等于研究有效或下载已落盘 |
| 恢复 | 每个 trial 前后写 IndexedDB；注视 trial 期间约每 1 s 保存 partial 快照；结束下载原始 JSON，可重下 | 崩溃可能丢失最后未提交的快照；部分记录标为 partial，不伪装成完整 trial。无远程后端；清理浏览器、隐私模式、存储失败均可能导致恢复不可用 |

Brown 算法核对源是安装的 `../WebGazer-master/www/js/precision_calculation.js`。回归测试直接执行该官方函数，对 100 组相同输入逐组比较，分数一致。公式：

`round(mean(max(0, 100 − 100 × distance_to_center / (viewport_height / 2))))`

**一致的是评分算式及本地实现的平滑／限界步骤；不声称两个程序的预测模型、采样时刻、完整 UI 或真实精度相同。** 本研究保留 [jsPsych 要求的兼容 fork](https://www.jspsych.org/v8/overview/eye-tracking/)，没有用下载的 Brown v3 bundle 直接替换。Brown 分数衡量中心距离，不是“90% 的 AOI 判断正确”。正式任务隐藏预测点及摄像头画面，保存坐标而非摄像头录像、GIF 或服务器录屏。

## 3. 四场景、八段音频和问题的精确清单

**按用户最新明确要求核对：继续使用现有 bend、break、crack、split 四个 minimalist 几何无声视频。** 音频是独立的 `cause to X` 和 `X`，不改为完整句子。`materials` 中的人物视频是另一套文件，不能据此认定当前实验选错了材料；此前“必须接入人物原视频”的判断已撤回。文件来源和更正记录见 [材料核查](docs/MATERIALS-AUDIT-2026-10-03.md)。

以下文字是当前代码中的刺激定义及来源声明；媒体已检查可解码，**尚未完成对八段录音的独立逐字听审和词边界标注**。

| 场景 | thick 音频 → 问题 | thin 音频 → 问题 | distal／proximal 选项 |
|---|---|---|---|
| 栅栏 | `break` → Who broke the fence? | `cause to break` → Who caused the fence to break? | The green triangle／The red cube |
| 路牌 | `bend` → Who bent the sign? | `cause to bend` → Who caused the sign to bend? | The blue car／The orange car |
| 画作 | `crack` → Who cracked the painting? | `cause to crack` → Who caused the painting to crack? | The yellow triangle／The purple cube |
| 饮料 | `split` → Who split the drink? | `cause to split` → Who caused the drink to split? | The teal capsule／The brown cube |

每场景播放一次 4.000 s 视频，之后两个 probe 各为 X fixation → 800 ms 图片预览 → 音频＋注视 → 书面问题＋两个选项＋作答。每个场景包含 thick、thin 各一次，先后顺序由分配表决定。视频显示 Scenario 1–4。初始 tracking gate 失败会跳过全部四场景；中点失败会跳过剩余场景，失败页显示中心分数和五点检查状态。

每个场景从视频开始至第二次回答结束，单一采样器在后台持续运行，覆盖视频、X、图片、音频、回答和阶段切换。`continuous_gaze` 保存原始坐标、请求／接收时间、场景、phase 及 viewport；`continuous_segments` 保存场景开始／结束。切换时晚到的预测保留在连续记录，但不塞进下一阶段成为负时间样本。校准检查独立存储；无脸、推理失败或设备低速仍可能掉样，并不承诺生理意义的无间断测量。此处“后台”指浏览器本地后台，尚无远程数据上传服务器。音频目前是原有 Samantha 短语录音，问题不朗读。此顺序对应原需求中的“verb → question”；若希望听完整问题，需要统一修改材料、音频和词起点。饮料场景按用户指定保留 split。所有文件路径与实际文本定义见 [src/stimuli.js](src/stimuli.js)。

## 4. 目前仍阻止正式研究的事项

1. **角色 AOI 尚未验证。** 当前是依据近似中心划分的空间左右区域，不是物体轮廓；1280 px 显示宽度下两角色距离约 307、294、333、166 px。200 px 容差可能跨过角色中线，因此“200 ≤ 224”不能证明这些场景可分。需要重新安排更清楚的角色显示、核对实际投影坐标，并做注视各角色的独立识别验证。视频动态角色 AOI 尚未标注，视频 gaze 只输出连续坐标。
2. **语言与时序尚未定稿。** 用户已确认 isolated `X`／`cause to X` 形式及 split；录音逐字听审和自然度尚未独立核验；每段关键词起点必须人工校对并记录标注来源。目前 `word_onset_ms=null`，不输出虚假的 word-locked 结果。蓝牙／声卡延迟和眼动模型延迟尚无硬件实测。
3. **设计仍是四场景、同一场景两种条件。** Latin square 改善顺序平衡，但不能消除重复暴露、carryover 或只有四个 item 的推论限制。正式方案需决定是否每位被试每个 item 只出现一种条件、是否增加材料，以及预注册排除规则和按目标效应做功效模拟。
4. **尚未有真人验证证据。** 自动测试使用模拟 tracker；需在拟使用的电脑、摄像头、眼镜和光照下测真实通过率、偏移、可分辨性、掉样与中断恢复。不能保证没有任何未知 bug，也不能保证每个被试的 gaze 都准确。

问卷变量能帮助发现质量关联，不能仅凭 self-report 判定某个环境因素“导致”失败。音频难度反向措辞也不能单独当作注意力测验。提前退出而没有经历的阶段，其评分保存为 null 并记录 exposure，不强迫被试评价未看过的视频／未听过的实验音频；预览没有校准，因此校准评分同样为 null。

## 5. 最终数据为何能在 R／Python 分析

原始 JSON 是审计主文件，保存完整结构、配置、分配、版本、构建指纹、媒体事件和未改写坐标。导出器不修改原文件，不静默删掉质量差的被试；无效样本保留并带标记，缺失值写为空字段，不能当 0。导出保留 preview 的模式标记；随附 R／Python 回答统计默认排除 `mode=preview` 与 `synthetic_test_data=true`，不得把预览当作受试者数据。

```sh
node analysis/export.mjs /path/to/session.json /path/to/derived
# 或导出目录中多个独立 session JSON：
node analysis/export.mjs /path/to/raw-sessions /path/to/derived
python3 analysis/describe.py /path/to/derived
Rscript analysis/describe.R /path/to/derived
```

| CSV | 分析用途／主键 |
|---|---|
| participants | 一行一 session；分配、版本、完成状态、环境、问卷。session_id 为主键；重测与真实 participant 的关联仍需研究者 roster |
| trials | 所有阶段、题干、选项、回答、RT、音视频与 QC；session_id＋logical_id |
| samples | 每条原始 gaze、source sample_index、x/y、Δx/Δy、时间、raw/corrected AOI、有效性；session_id＋logical_id＋sample_index |
| continuous_samples | 跨阶段的场景原始注视流，包括作答；session_id＋sample_index。与 samples 重叠，不能合并后重复计数 |
| windows | phase、corrected_phase、word_window、corrected_word_window；均值、SD、停留、缺失、质量状态；未验证词起点的窗口明确 unavailable |
| bins | 100 ms 时间窗，用于探索时间过程；保留音频相对时间，不将 bin 当成真实采样帧 |
| validation_points | 每次 validation 的每个目标质量，可按人／阶段汇总 |
| events | 分支、开始／结束和窗口交互，定位跳过、中断与异常 |
| partial_samples | 崩溃恢复中尚未完成的 gaze，独立保存，不混入完整 trial |

CSV 为 UTF-8，时间字段有 ms/s 后缀，坐标为 CSS px；`x_signed_distal` 按实际角色中心标准化（distal=+1、proximal=−1、中线=0），不是屏幕中线；几何和复杂事件列保留 JSON 字符串，可用 Python `json` 或 R `jsonlite` 展开。导出拒绝重复 session_id，避免把原下载与恢复副本重复计入。原始 JSON 中还保留 Brown 50 点输入和 validation 原始数据，CSV 汇总并未取代它们。

当前合适的分析是**技术质量与描述统计**：通过／退出率、采样率、缺失率、条件内被试均值和回答比例。材料验证后，再预注册 trial-level gaze 分配的混合效应模型，以及二分类回答的 logistic mixed model；保留 subject/item/condition/order 结构。不能将几千个 gaze 点作为几千个独立被试进行 t 检验或 ANOVA。具体估计量、窗口和限制见 [METHODS-AND-TECH-SPEC.md](docs/METHODS-AND-TECH-SPEC.md)。

## 6. 75 分门槛与 56 分排查（2026-10-03）

门槛曾从 `>90` 改为 `≥80`；本次按要求改为 `≥75`，75 本身可通过；五点 validation 的 200 px／每点 50%／15 Hz 门槛保持不变。评分算式不变，降低门槛不会把 56 算成 75。

56 分意味着最后 50 个评分点相对屏幕中心的**平均截断距离约为窗口高度的 22%**（取整有误差）；例如高度为 1000 CSS px，则约 220 px。这里不是“56% 的样本正确”。需要原始记录才能判断是稳定偏移、抖动、跟踪丢失还是其他原因。

已修复：中心测量错误地恢复了 WebGazer 后台循环，造成其与 jsPsych 轮询并行；现在中心测量、validation 和任务使用暂停后台循环的单一轮询。校准训练只接收目标点击，移除鼠标轨迹训练；增加等待、新鲜帧检查和模型实际接收计数；校准点置于相对 viewport 的准确中心。

恢复页 `/recovery.html` 的 **Calibration diagnostics** 可查看分数复算、水平／垂直偏移、离散程度、样本量、训练接受数及每点 validation。原始文件也可运行 `node analysis/calibration-report.mjs session.json`。旧记录没有新加的训练接收计数时显示 null，不能事后宣称训练有效。

本次尚未取得用户报告 56 分的对应原始 session，不能声称已确定该次低分的唯一原因；真人复测仍待完成。代码审查证据和测试见 [CALIBRATION-AUDIT-2026-10-03.md](docs/CALIBRATION-AUDIT-2026-10-03.md)。

## 7. 红点与延迟（v2.3）

红点是当前模型的预测。校准尚未完成时，模型只见过部分位置，红点偏离新目标不能直接当作最终精度。请看固定的深色目标点，不要追着红点训练；validation 记录无点击时的预测误差。按当前要求，validation 显示红点，数据明确标记 `gaze_feedback_visible=true` 和 `validation_context=visible-prediction-feedback`；可见反馈可能引导注视，不能描述为无反馈的独立验证。请始终看深色目标点。Brown 中心评分仍隐藏预测点。

本次修复了后台循环在暂停／恢复边界重复运行的风险，统一串行执行推理，并缓存未改变训练数据的回归系数。红点现在显示最新模型估计，不再额外平均最近四帧；超出屏幕的预测不伪装成边缘位置。去掉这层显示平滑可能使红点更抖，不能因此声称准确度提高。模型原有 Kalman 滤波及 Brown 的评分平滑保持不变。

`inference_duration_ms` 和恢复页里的推理耗时统计可定位软件计算瓶颈；它们不包括完整的摄像头曝光、采集和屏幕呈现延迟。本机真实回归代码＋合成眼部图像测试：12 次预测未缓存约 19.6 ms、缓存约 11.1 ms，输出坐标完全相同。这不是本人的实测追踪延迟；用户报告的真人偏移仍未得到原始 session／观察验证。

## 8. 本次检查及未覆盖范围

可复现的测试记录见 [VERIFICATION.md](docs/VERIFICATION.md)。测试覆盖 Brown 算式、Latin square 平衡、晚到预测隔离、异常 promise、缺失／重复记录、时间窗计时、播放结束／拒绝／超时和浏览器保存流程。它证明这些已测情形得到处理，**不能证明所有风险都被彻底预防**。正式招募前应冻结版本、完成上述四项研究检查，并至少演练一次真实设备的全流程、切页／退出和数据恢复。
