# Crystal: Comparative Design Analysis

Phase 5 deliverable. It compares the six references from the [Reference Website Analysis](02-reference-website-analysis.md), to show where they agree, where they differ, and which approaches suit Crystal. A common pattern isn't automatically the right one: a pattern is judged on Crystal's needs, and approved decisions in the [Decision Register](DECISION_REGISTER.md) stand.

## 1. Key findings

1. **The six are closer than they look.** Orvel, Talvo, Rivolo, Rivet and Tilvo share a structure: summary first, then one main chart, then a list. They differ mostly in brand and density.
2. **Two sites do real work for you.** Orvel's Review queue and Talvo's forecast suggest what to do next. The others mainly report.
3. **The best phone work isn't just shrinking.** Rivolo's week strip, Tilvo's vertical timeline, Orvel's Select mode and Rivet's reduced rows change the design for a phone.
4. **Rapport is the outlier on navigation,** which is the one you chose (`D-002`, `D-003`). It's the only reference with no labelled bottom navigation on phones, so Crystal has less to borrow here and must design it carefully.
5. **Writing is a design feature.** Orvel, Talvo and Rivolo use plain, specific sentences, while Crystal's labels are often technical. This supports `S-005`.
6. **No reference covers Crystal's whole range,** because Crystal does more than any one of them.

## 2. Comparison matrix

**Key:** Yes = seen. Partly = a limited version. No = not found. Not seen = not checked, so it may exist.

### Structure and navigation

| Pattern | Rapport | Orvel | Talvo | Rivolo | Rivet | Tilvo |
|---|---|---|---|---|---|---|
| Top navigation | **Yes** | No | No | No | No | **Yes, icons** |
| Left sidebar | Tool rail | **Yes** | **Yes** | **Yes** | **Yes** | No |
| Expanding menu groups | No | **Yes** | **Yes** | **Yes** | Partly | No |
| Count badges in navigation | No | **Yes** | **Yes** | **Yes** | Partly | No |
| Tablet icon rail | No | **Yes** | **Yes** | **Yes** | Not seen | Not seen |
| Phone bottom tabs | No | **Yes** | **Yes** | **Yes** | No | **Yes** |
| Phone pills and toolbar | **Yes** | No | No | No | No | No |
| Phone hamburger menu | No | No | No | No | **Yes** | No |
| Command palette | **Yes** | Yes | Yes | **Best** | Yes | Search icon |
| Sub-pages as tabs | No | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| Global Create menu | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

### Dashboard and summaries

| Pattern | Rapport | Orvel | Talvo | Rivolo | Rivet | Tilvo |
|---|---|---|---|---|---|---|
| Written summary sentence | No | **Linked** | **Yes** | **Yes** | Greeting | Greeting |
| Needs-action list | No | **Yes** | **Yes** | Partly | Partly | No |
| Safe to spend or runway | No | Cash cover | Cost cover | **Safe to spend** | Health score | No |
| Split bar for money | Stage mix | **Yes** | **Yes** | **Yes** | **Allocation** | No |
| Key figure always visible | No | **Sidebar, top bar** | **Sidebar** | No | No | No |
| Live activity pop-ups | No | **Yes** | **Yes** | No | No | No |

### Money workflows

| Pattern | Rapport | Orvel | Talvo | Rivolo | Rivet | Tilvo |
|---|---|---|---|---|---|---|
| Review queue | No | **Yes** | No | No | No | No |
| Plain-language rules | No | **Yes** | No | No | No | No |
| Rule from a transaction | No | **Yes** | No | No | No | No |
| Forecast with what-if | No | Partly | **Best** | Partly | Partly | **Planner** |
| Budget pace | No | No | **Yes** | Partly | **Yes** | No |
| Inline limit editing | No | No | **Yes** | No | Not seen | No |
| Compared with your usual | No | Partly | Partly | **Yes** | No | No |
| Master-detail directory | No | No | No | **Payees** | No | No |
| Portfolio page | No | No | Treasury | No | **Yes** | No |
| Subscription page | No | No | No | Scheduled | Partly | **Yes** |
| Bank connection health | No | No | No | Connections | **Yes** | No |
| Loan what-if | No | No | **Yes** | No | No | No |

### Components and interaction

| Pattern | Rapport | Orvel | Talvo | Rivolo | Rivet | Tilvo |
|---|---|---|---|---|---|---|
| Side panel details | **Yes** | **Yes** | Not seen | **Yes** | **Yes** | **Yes** |
| Phone bottom sheets | **Yes** | Not seen | Not seen | Not seen | **Yes** | Not seen |
| Table becomes rows on phone | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | Not seen |
| Phone multi-select | No | **Yes** | Not seen | Not seen | Not seen | Not seen |
| Status filters with counts | Partly | **Yes** | **Yes** | **Yes** | Partly | Partly |
| Drag to reschedule | No | No | **Tested** | Stated | No | Stated |
| Keyboard shortcuts in flows | Palette | **Queue** | **Arrows, L** | Palette | Palette | Not seen |
| Undo after an action | Not seen | Not seen | **Yes** | Not seen | Not seen | Not seen |
| Dark mode | **Yes** | **Yes** | **Yes** | **Yes** | **Default** | Not seen |
| PIN lock | No | Not seen | **Yes** | Not seen | Not seen | Not seen |

## 3. Different approaches

### Navigation

| Approach | Sites | Best for | Weakness |
|---|---|---|---|
| Grouped sidebar | Orvel, Talvo, Rivolo, Rivet | Many pages | Takes width |
| Top pills and tool rail | Rapport | Few destinations, a distinctive look | Two navigation systems |
| Icon-only bar | Tilvo | Minimal look | Depends on recognising icons |

**Crystal's position:** `D-002` and `D-005` use Rapport's model with seven hubs and tabs. Tabs carry the depth that sidebars carry elsewhere.

### Dashboards

| Approach | Site | Leads with | Weakness |
|---|---|---|---|
| Action-led | Orvel | What needs you | Less forward view |
| Forward-looking | Talvo | Cash and what's coming | Densest |
| Personal | Rivolo | What you can spend | Less control |
| Portfolio | Rivet | Wealth trend | Less daily use |
| Showcase | Rapport | Large figures | Low data density |

**Crystal's position:** `D-004` combines the first three.

### Lists and tables

| Approach | Site | Strength | Weakness |
|---|---|---|---|
| Table with status filters | Talvo, Orvel | Scanning | Heavier on phone |
| Day-grouped list and side summary | Rivolo | Calm and personal | Fewer visible fields |
| Sparkline table | Rivet | Trend inside the row | Needs wide screens |
| Stacked cards | Rapport | Rich on phone | Slower to scan |

### Showing money

| Approach | Site | Note |
|---|---|---|
| Sentence | Orvel | Best for explaining |
| Split bar | Orvel, Talvo, Rivolo, Rivet | Better than a donut for two to five parts |
| Scatter | Orvel | Distinctive, but needs explanation |
| Forecast with buffer | Talvo | Best for decisions |
| Compared with usual | Rivolo | Best for spending insight |
| Colour blocks | Rapport | Eye-catching, but can compete with figures |

### Phone experience

| Approach | Site | Result |
|---|---|---|
| Rethink the content | Rivolo calendar, Tilvo timeline | Best |
| Remove columns and keep the job | Rivet holdings, Talvo transactions | Very good |
| Add a phone mode | Orvel Select | Very good |
| Keep the desktop structure | Rapport Kanban, month grid | Weakest |

## 4. Strongest and weakest decisions

### Strongest

| Rank | Decision | Site | Why |
|---|---|---|---|
| 1 | Forecast you can change | Talvo | Turns prediction into a decision |
| 2 | Review queue | Orvel | Makes cleanup fast on any device |
| 3 | Rule from a transaction | Orvel | Creates automation exactly when it's needed |
| 4 | Linked written summary | Orvel | Connects information and action |
| 5 | Safe to spend | Rivolo | Answers a real personal question |
| 6 | Payees workspace | Rivolo | A complete profile with no page change |
| 7 | Week strip on phones | Rivolo | Keeps the task with far less width |
| 8 | Rebalance check | Rivet | Turns portfolio data into a decision |
| 9 | Saved by pausing | Tilvo | Shows value in plain terms |
| 10 | Arrow keys for drag | Talvo | Accessible interaction by design |

### Weakest

| Decision | Site | Why it matters to Crystal |
|---|---|---|
| Horizontal Kanban on phone | Rapport | Avoid this pattern for any wide content |
| Month grid with dots on phone | Rapport | Already replaced by `D-007` |
| Icon-only navigation | Tilvo | Hard to learn at Crystal's size |
| Unlabelled tool rail | Rapport | **Applies to `D-002`.** Crystal should consider labels or tooltips |
| Primary navigation at the top on phones | Rapport | **Applies to `D-003`.** Toolbar must carry the most-used actions |
| Dense first screen | Talvo | **Applies to `D-004`.** Three summaries need strict order |
| 10 to 12 px labels | Talvo, Tilvo, Rapport | Avoid small text in Crystal |
| Unexplained scale | Orvel scatter | **Applies to `D-006`.** Needs a caption and a list |
| Fake candlesticks from logged points | Crystal, compared with Rivet | `DEF-03` |

## 5. Unique components worth considering

| Component | Site | Crystal area | Status |
|---|---|---|---|
| Runway in the page chrome | Orvel | Global | Open |
| "What moves the line" | Talvo | Forecast | Open |
| Stay above your buffer | Talvo | Forecast | Open |
| Loan pay-extra slider | Talvo | Loans | Open |
| Rebalance check | Rivet | Investments | New function |
| Watchlist | Rivet | Investments | New function |
| Paused and cancelled tab | Tilvo | Subscriptions | New function |
| Rules worth making | Orvel | Rules | Crystal has suggestions |
| Compared with usual | Rivolo | Reports, Budget | Open |
| PIN lock | Talvo | Global | Open, `O-005` |
| Bank sync health | Rivet | Bank connections | Open |
| Statement archive | Rivet, Orvel | Data | Open |

"New function" means Crystal doesn't do this today. Adding one is a product decision, not just a redesign choice.

## 6. Apple HIG view

| Category | What the comparison shows |
|---|---|
| Accessibility requirements | All six need checking for contrast and small text. Colour alone can't carry meaning in charts, tags or status. Talvo's arrow keys are the model for any drag |
| General UX principles | Summaries that lead to action, feedback in context and Undo all align with HIG. Rivolo's and Tilvo's phone changes match its layout advice |
| Apple platform conventions | Bottom tabs are the Apple norm, and four of six use them. Crystal chose differently, which is acceptable because this is a convention |
| Optional visuals | No reference needs Apple styling, and none is imposed |

## 7. What this means for Crystal

**Borrow from each reference**

| Crystal area | Main source | Secondary |
|---|---|---|
| Look and feel | Orvel | Rapport's warmth |
| Navigation | Rapport | Orvel's tabs and badges |
| Dashboard | Orvel | Rivolo, Talvo |
| Transactions | Orvel | Rivolo |
| Rules | Orvel | To be decided |
| Forecasting | Talvo | To be decided |
| Budget | Talvo | Rivolo, Rivet |
| Calendar | Rapport | Rivolo |
| Merchants | Rivolo | Orvel |
| Investments | Rivet | Talvo |
| Subscriptions | Tilvo | Rivet |
| Reports | Orvel | Talvo, Rivolo |
| Bank connections | Rivet | Rivolo |

**No reference yet:** loyalty cards, challenges, data import, and property and vehicle assets.
