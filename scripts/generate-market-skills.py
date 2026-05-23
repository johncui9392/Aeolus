#!/usr/bin/env python3
"""批量生成 AIFin Market 对齐的 Aeolus 技能插件（manifest + get_data.py）。"""

from __future__ import annotations

import json
import textwrap
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SKILLS = REPO / "skills"
LIB = SKILLS / "_lib"

ALICE_GET_DATA = '''import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from wind_alice_runner import main_entry

if __name__ == "__main__":
    main_entry(
        alice_skill="{alice_skill}",
        skill_label="{title}",
        output_subdir="{folder}",
        default_query="{default_query}",
    )
'''

AGENT_GET_DATA = '''import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_lib"))
from agent_skill_stub import main_entry

if __name__ == "__main__":
    main_entry(
        skill_label="{title}",
        output_subdir="{folder}",
        skill_md_name="{folder}",
    )
'''

# 万得官方 Alice 云端（14）
ALICE_OFFICIAL = [
    ("Wind_BondRateOutlook", "wind_bond_rate_outlook", "债券利率走势研判", "债券利率走势研判", "10年期国债利率未来走势研判"),
    ("Wind_CompanyOnePage", "wind_company_one_page", "上市公司一页纸投资报告", "公司一页纸", "贵州茅台 一页纸投资报告"),
    ("Wind_CompsAnalysis", "wind_comps_analysis", "可比公司分析", "可比公司分析", "东方财富 可比公司分析"),
    ("Wind_CreditAnalysis", "wind_credit_analysis", "信用分析", "信用分析", "某城投平台信用分析"),
    ("Wind_FactCheck", "wind_fact_check", "金融事实核验", "事实核验", "核验以下金融数据是否准确"),
    ("Wind_FundScreening", "wind_fund_screening", "基金筛选与投资建议", "基金筛选与投资建议", "稳健型投资者基金推荐"),
    ("Wind_GlobalEarningsReview", "wind_global_earnings_review", "全球上市公司财报点评", "全球上市公司季报点评", "贵州茅台 2024年报点评"),
    ("Wind_InflationBondStrategy", "wind_inflation_bond_strategy", "通胀情景债券交易策略", "通胀情景债券轮动策略", "当前通胀情景下债券配置建议"),
    ("Wind_InvestmentIdeas", "wind_investment_ideas", "投资机会挖掘", "投资标的创意与筛选", "科技板块投资机会挖掘"),
    ("Wind_MacroInterpretation", "wind_macro_interpretation", "宏观数据解读", "宏观数据解读", "最新CPI PPI数据解读"),
    ("Wind_MarketSizing", "wind_market_sizing", "市场规模测算与战略建模", "市场规模测算与战略建模", "中国储能市场规模测算"),
    ("Wind_FundCompare", "wind_fund_compare", "公募基金对比分析", "基金对比分析", "易方达蓝筹精选 vs 兴全合润"),
    ("Wind_StockDDList", "wind_stock_dd_list", "上市公司调研问题清单", "上市公司调研问题清单", "宁德时代 调研问题清单"),
    ("Wind_ThematicScreening", "wind_thematic_screening", "主题选股", "按主题选股", "人工智能产业链主题选股"),
]

# 金融技能 · 社区（wind-skills 本地 Agent 工作流）
COMMUNITY = [
    ("earnings_analysis", "wind_earnings_analysis", "财报解读", "撰写机构级财报更新报告"),
    ("dcf_model", "wind_dcf_model", "DCF 估值模型", "创建完整 DCF 估值模型"),
    ("valuation_pricing_framework", "wind_valuation_framework", "估值与定价框架", "公司估值与定价框架分析"),
    ("position_sizer", "wind_position_sizer", "凯利尺规 - 仓位", "按风险预算计算仓位"),
    ("backtest_expert", "wind_backtest_expert", "战略级投资利器-回测", "量化策略系统化回测"),
    ("market_environment_analysis", "wind_market_environment", "战略级投资利器-宏观", "全球市场环境分析"),
]

# 金融技能 · WindClaw
WINDCLAW = [
    ("valuation_snapshot_skill", "wind_valuation_snapshot", "估值快照", "个股估值快照与分位"),
    ("bull_bear_case_builder_skill", "wind_bull_bear_case", "多空论证", "看多看空逻辑论证"),
    ("peer_comparison_decision_skill", "wind_peer_comparison", "同业比选", "同业候选公司比选"),
    ("moat_strength_review_skill", "wind_moat_review", "护城河评估", "公司护城河强度评估"),
    ("business_model_decoder_skill", "wind_business_model", "业务模式拆解", "公司业务模式拆解"),
    ("major_announcement_impact_skill", "wind_announcement_impact", "公告影响", "重大公告影响分析"),
    ("conference_call_takeaway_skill", "wind_conference_takeaway", "业绩会提炼", "业绩会要点提炼"),
    ("guidance_change_impact_skill", "wind_guidance_change", "指引变动", "业绩指引变动影响"),
    ("sec_filing_question_answer_skill", "wind_sec_filing_qa", "监管文件答疑", "SEC 监管文件答疑"),
    ("sector_rotation_radar_skill", "wind_sector_rotation", "板块轮动雷达", "板块轮动与风格迁移"),
    ("market_regime_switch_skill", "wind_market_regime", "市场状态判档", "市场进攻防守阶段判断"),
    ("institutional_position_shift_skill", "wind_institutional_shift", "机构调仓洞察", "机构持仓变化洞察"),
    ("theme_leader_identification_skill", "wind_theme_leader", "题材龙头", "题材龙头与中军识别"),
    ("breakout_candidate_finder_skill", "wind_breakout_candidate", "突破候选", "突破形态候选股筛选"),
    ("pullback_opportunity_finder_skill", "wind_pullback_opportunity", "回调机会", "趋势回调低吸机会"),
    ("high_quality_compounder_finder_skill", "wind_high_quality_compounder", "高质复利", "高质量复利候选筛选"),
    ("trade_plan_builder_skill", "wind_trade_plan", "交易计划", "单笔交易执行计划"),
    ("position_sizing_decision_skill", "wind_position_sizing", "仓位决策", "单笔仓位与分批建议"),
    ("stop_loss_discipline_skill", "wind_stop_loss", "止损纪律", "止损规则与执行纪律"),
    ("take_profit_ladder_skill", "wind_take_profit", "分批止盈", "盈利仓分批止盈规划"),
]

SKIP_DIRS = {
    "Wind_PostMarketDebrief",
    "Wind_EquityInvestmentThesis",
    "Wind_ASharePrimaryTheme",
    "Wind_MarketRegimeSwitch",
    "Wind_ThemeDetector",
    "Wind_FinData",
    "wind-alice-runtime",
    "_lib",
}


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_alice_skill(folder: str, skill_id: str, title: str, alice_skill: str, default_query: str) -> None:
    if folder in SKIP_DIRS:
        return
    root = SKILLS / folder
    if (root / "manifest.json").exists() and folder.startswith("Wind_") and folder not in {
        "Wind_BondRateOutlook", "Wind_CompanyOnePage", "Wind_CompsAnalysis",
    }:
        pass
    scripts = root / "scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    manifest = {
        "id": skill_id,
        "name": folder,
        "title": title,
        "description": title + "。基于万得 Alice 云端 Skill，报告篇幅较长。",
        "placeholder": f"例如: {default_query}",
        "icon": "FileText",
        "category": "market",
        "vendor": "wind",
        "tier": "free",
        "needsSelectType": False,
        "selectOptions": [],
        "apiKeyProvider": "wind",
        "script": "get_data.py",
        "argsTemplate": ["--query", "{query}"],
        "marketCategory": "万得官方",
    }
    write_json(root / "manifest.json", manifest)
    (scripts / "get_data.py").write_text(
        ALICE_GET_DATA.format(
            alice_skill=alice_skill,
            title=title,
            folder=folder,
            default_query=default_query,
        ),
        encoding="utf-8",
    )
    print(f"  Alice  {folder}")


def ensure_agent_skill(folder: str, skill_id: str, title: str, desc: str, market_category: str) -> None:
    if folder in SKIP_DIRS:
        return
    root = SKILLS / folder
    scripts = root / "scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    manifest = {
        "id": skill_id,
        "name": folder,
        "title": title,
        "description": desc + "。Agent 工作流 Skill（SKILL.md 驱动），Web 端返回使用指引。",
        "placeholder": f"例如: {title}相关分析",
        "icon": "Puzzle",
        "category": "market",
        "vendor": "wind",
        "tier": "free",
        "needsSelectType": False,
        "selectOptions": [],
        "script": "get_data.py",
        "argsTemplate": ["--query", "{query}"],
        "executionMode": "agent",
        "marketCategory": market_category,
    }
    write_json(root / "manifest.json", manifest)
    (scripts / "get_data.py").write_text(
        AGENT_GET_DATA.format(title=title, folder=folder),
        encoding="utf-8",
    )
    print(f"  Agent  {folder}")


def ensure_tushare() -> None:
    folder = "Tushare_FinData"
    root = SKILLS / folder
    scripts = root / "scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    manifest = {
        "id": "tushare_findata",
        "name": folder,
        "title": "Tushare 金融数据",
        "description": "官方 Tushare Pro 数据查询：A股行情、财务、宏观等。需 TUSHARE_TOKEN。",
        "placeholder": "例如: 贵州茅台最近20日收盘价",
        "icon": "Database",
        "category": "market",
        "vendor": "tushare",
        "tier": "free",
        "needsSelectType": False,
        "selectOptions": [],
        "apiKeyProvider": "tushare",
        "script": "get_data.py",
        "argsTemplate": ["--query", "{query}"],
        "marketCategory": "数据获取",
    }
    write_json(root / "manifest.json", manifest)
    tushare_py = scripts / "get_data.py"
    if not tushare_py.exists():
        tushare_py.write_text(
            (LIB / "tushare_runner_template.py").read_text(encoding="utf-8"),
            encoding="utf-8",
        )
    skill_md = root / "SKILL.md"
    if not skill_md.exists():
        skill_md.write_text(
            textwrap.dedent(
                """\
                ---
                name: tushare-data
                description: 官方 Tushare Pro 金融数据 Skill（waditu-tushare/skills）
                ---

                # Tushare 金融数据

                数据来源：[Tushare Pro](https://tushare.pro) · 官方 Skill 仓库 [waditu-tushare/skills](https://github.com/waditu-tushare/skills)

                Aeolus Web 端通过 `TUSHARE_TOKEN` 调用基础行情接口；完整 Agent 工作流请安装官方 Skill：

                ```bash
                npx skills add https://github.com/waditu-tushare/skills --skill tushare-data -y
                ```
                """
            ),
            encoding="utf-8",
        )
    print(f"  Tushare {folder}")


def main() -> None:
    print("生成 AIFin Market 对齐技能…")
    for row in ALICE_OFFICIAL:
        ensure_alice_skill(*row)
    for folder, sid, title, desc in COMMUNITY:
        ensure_agent_skill(folder, sid, title, desc, "金融技能")
    for folder, sid, title, desc in WINDCLAW:
        if folder == "market_regime_switch_skill":
            continue  # 已有 Wind_MarketRegimeSwitch
        ensure_agent_skill(folder, sid, title, desc, "金融技能")
    ensure_tushare()
    print("完成。")


if __name__ == "__main__":
    main()
