import sys
import datetime
from WindPy import w
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib import rcParams
from PyQt5.QtWidgets import (QApplication, QMainWindow, QTabWidget, QWidget, 
                            QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
                            QDateEdit, QComboBox, QTextEdit, QScrollArea, 
                            QSpinBox, QMessageBox, QLineEdit, QTableWidget,
                            QHeaderView, QTableWidgetItem, QGroupBox)
from PyQt5.QtCore import QDate, Qt, QThread, pyqtSignal, QTimer
from PyQt5.QtGui import QColor  # 在文件顶部添加导入

# 设置中文字体
rcParams['font.sans-serif'] = ['PingFang SC', 'SimHei', 'Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS']  # 支持中文的字体列表
rcParams['axes.unicode_minus'] = False  # 用来正常显示负号

# Financial tools imports
from financial_tools.stock_analysis import (
    getstocklist, return_period_highlow, 
    test_last_day_stock_price, highlowautoeye
)
from financial_tools.index_signals import index_signal_wind
from financial_tools.volatility import get_volatility_analysis
from financial_tools.valuation import monitor_index_valuation
from financial_tools.tradingvolume_realtime import get_combined_volume_data
from financial_tools.realtime_data import get_realtime_data
from financial_tools.gold_realtime import GoldRealtime
from financial_tools.A50_realtime import A50Realtime
from financial_tools.uc00_realtime import Uc00Realtime
from financial_tools.nq_realtime import NqRealtime
from financial_tools.es_realtime import EsRealtime
from financial_tools.ym_realtime import YmRealtime
from financial_tools.btc_realtime import BtcRealtime

from utility_tools.market_tab_utils import add_market_tab, toggle_monitoring, start_market_updates, stop_market_updates, update_market_display, reset_market_tab
from utility_tools.rtd_market_tab_utils import add_stock_realtime_tab

class FinancialAnalysisApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("金融数据分析平台")
        self.setGeometry(100, 100, 1200, 800)
        
        # Create main tab widget
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)
        
        # Add home tab
        self.add_home_tab()
    def add_home_tab(self):
        """添加首页标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 首页标题
        title_label = QLabel("欢迎使用金融数据分析平台")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("font-size: 24px; font-weight: bold;")
        layout.addWidget(title_label)
        
        # 分类布局
        # 分析类功能
        analysis_group = QGroupBox("数据分析")
        analysis_layout = QVBoxLayout()
        
        # 股票高低点分析按钮
        highlow_btn = QPushButton("股票高低点分析")
        highlow_btn.clicked.connect(lambda: self.show_tab("股票高低点分析", self.add_highlow_tab))
        analysis_layout.addWidget(highlow_btn)
        
        # 指数轮动信号按钮
        signal_btn = QPushButton("指数轮动信号")
        signal_btn.clicked.connect(lambda: self.show_tab("指数轮动信号", self.add_signal_tab))
        analysis_layout.addWidget(signal_btn)
        
        # 估值分析按钮
        valuation_btn = QPushButton("估值分析")
        valuation_btn.clicked.connect(lambda: self.show_tab("估值分析", self.add_valuation_tab))
        analysis_layout.addWidget(valuation_btn)
        
        # 波动率分析按钮
        volatility_btn = QPushButton("波动率分析")
        volatility_btn.clicked.connect(lambda: self.show_tab("波动率分析", self.add_volatility_tab))
        analysis_layout.addWidget(volatility_btn)
        
        # 成交分析按钮
        volume_btn = QPushButton("沪深两市成交分析")
        volume_btn.clicked.connect(lambda: self.show_tab("沪深两市成交分析", self.add_volume_tab))
        analysis_layout.addWidget(volume_btn)
        
        analysis_group.setLayout(analysis_layout)
        layout.addWidget(analysis_group)
        
        # 实时行情类功能
        realtime_group = QGroupBox("实时行情")
        realtime_layout = QVBoxLayout()
        
        # 黄金现货实时行情按钮
        gold_btn = QPushButton("黄金现货实时行情")
        gold_btn.clicked.connect(lambda: self.show_tab("黄金现货实时行情", self.add_gold_tab))
        realtime_layout.addWidget(gold_btn)
        
        # A50实时行情按钮
        a50_btn = QPushButton("A50实时行情")
        a50_btn.clicked.connect(lambda: self.show_tab("A50实时行情", self.add_A50_tab))
        realtime_layout.addWidget(a50_btn)
        
        # 比特币实时行情按钮
        btc_btn = QPushButton("比特币实时行情")
        btc_btn.clicked.connect(lambda: self.show_tab("比特币实时行情", self.add_btc_tab))
        realtime_layout.addWidget(btc_btn)
        # 人民币美元离岸汇率实时行情按钮
        uc00_btn = QPushButton("人民币美元离岸汇率实时行情")
        uc00_btn.clicked.connect(lambda: self.show_tab("人民币美元离岸汇率行情", self.add_uc00_tab))
        realtime_layout.addWidget(uc00_btn)

        # 纳斯达克 100 实时行情按钮
        nq_btn = QPushButton("纳斯达克 100 实时行情")
        nq_btn.clicked.connect(lambda: self.show_tab("纳斯达克 100 行情", self.add_nq_tab))
        realtime_layout.addWidget(nq_btn)

        # 标普 500 实时行情按钮
        es_btn = QPushButton("标普 500 实时行情")
        es_btn.clicked.connect(lambda: self.show_tab("标普 500 行情", self.add_es_tab))
        realtime_layout.addWidget(es_btn)

        # 道琼斯指数股指期货实时行情按钮
        ym_btn = QPushButton("道琼斯指数股指期货实时行情")
        ym_btn.clicked.connect(lambda: self.show_tab("道琼斯指数股指期货行情", self.add_ym_tab))
        realtime_layout.addWidget(ym_btn)

        # 综合行情看板按钮
        composite_btn = QPushButton("综合行情看板")
        composite_btn.clicked.connect(lambda: self.show_tab("综合行情看板", self.add_composite_board_tab))
        realtime_layout.addWidget(composite_btn)
        
        realtime_group.setLayout(realtime_layout)
        layout.addWidget(realtime_group)

        # 股票实时行情按钮
        stock_realtime_btn = QPushButton("股票实时行情")
        # 修改此处调用方式
        stock_realtime_btn.clicked.connect(lambda: self.show_tab("股票实时行情", lambda: add_stock_realtime_tab(self)))
        realtime_layout.addWidget(stock_realtime_btn)
        
        realtime_group.setLayout(realtime_layout)
        layout.addWidget(realtime_group)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "首页")

    def show_tab(self, tab_name, add_tab_func):
        """显示指定标签页"""
        # 检查标签页是否已存在
        for i in range(self.tabs.count()):
            if self.tabs.tabText(i) == tab_name:
                self.tabs.setCurrentIndex(i)
                return
        
        # 若不存在则添加新标签页
        add_tab_func()
        self.tabs.setCurrentIndex(self.tabs.count() - 1)

    def add_highlow_tab(self):
        """股票高低点分析标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 指数选择
        control_layout.addWidget(QLabel("选择指数:"))
        self.index_combo = QComboBox()
        
        # 定义 windcode 到中文简称的映射字典
        windcode_to_name = {
            "000016.SH": "上证50",
            "000300.SH": "沪深300",
            "000905.SH": "中证500",
            "000852.SH": "中证1000",
            "932000.CSI": "中证2000",
            "1000051463000000": "期货主连"
        }
        
        windcodes = ["000016.SH", "000300.SH", "000905.SH", "000852.SH", "932000.CSI","1000051463000000"]
        chinese_names = [windcode_to_name.get(code, code) for code in windcodes]
        
        self.index_combo.addItems(chinese_names)
        
        # 存储映射关系，方便后续使用
        self.windcode_mapping = dict(zip(chinese_names, windcodes))
        
        control_layout.addWidget(self.index_combo)
        
        # 日期选择
        control_layout.addWidget(QLabel("分析日期:"))
        if not w.isconnected():
            w.start()
        now = datetime.datetime.now()
        last_trading_day = w.tdaysoffset(0, now.strftime('%Y-%m-%d')).Data[0][0]
        # 检查 last_trading_day 类型，如果是字符串则转换为 datetime 对象
        if isinstance(last_trading_day, str):
            last_trading_day = datetime.datetime.strptime(last_trading_day, '%Y-%m-%d')
        self.date_edit = QDateEdit(QDate(last_trading_day.year, last_trading_day.month, last_trading_day.day))
        # 设置日期选择框的固定宽度
        fixed_width = 150  # 可以根据实际情况调整
        self.date_edit.setFixedWidth(fixed_width)
        control_layout.addWidget(self.date_edit)
        
        # 新增：天数输入框
        control_layout.addWidget(QLabel("分析天数:"))
        self.days_input = QLineEdit()
        self.days_input.setPlaceholderText("默认60天")
        # 设置输入框的固定宽度与日期选择框一致
        self.days_input.setFixedWidth(fixed_width)
        control_layout.addWidget(self.days_input)
        
        # 分析按钮
        self.analyze_btn = QPushButton("开始分析")
        self.analyze_btn.clicked.connect(self.run_highlow_analysis)
        control_layout.addWidget(self.analyze_btn)
        
        # 重置按钮
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(self.reset_highlow_tab)
        control_layout.addWidget(reset_btn)
        
        layout.addLayout(control_layout)
        
        # 结果显示区域，使用水平布局将两个文本框放在左右两侧
        result_layout = QHBoxLayout()
    
        self.high_result = QTextEdit()
        self.high_result.setReadOnly(True)
        # 设置字体大小
        font = self.high_result.font()
        font.setPointSize(12)  # 可以根据需要调整字体大小
        self.high_result.setFont(font)
        result_layout.addWidget(self.high_result)
        
        self.low_result = QTextEdit() 
        self.low_result.setReadOnly(True)
        # 设置字体大小
        font = self.low_result.font()
        font.setPointSize(12)  # 可以根据需要调整字体大小
        self.low_result.setFont(font)
        result_layout.addWidget(self.low_result)
        
        layout.addLayout(result_layout)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "股票高低点分析")
    
    def run_highlow_analysis(self):
        """执行高低点分析"""
        # 获取选中的中文简称
        selected_name = self.index_combo.currentText()
        # 通过映射关系获取对应的 windcode
        index_code = self.windcode_mapping.get(selected_name, selected_name)
        
        analysis_date = self.date_edit.date().toString("yyyy-MM-dd")
        if not w.isconnected():
            w.start()
        # 获取股票列表
        stockcodelist = getstocklist(index_code)
        
        # 获取输入的天数，如果未输入则使用默认值60
        days_text = self.days_input.text()
        period_days = int(days_text) if days_text.isdigit() else 60
        
        # 计算高低点
        high_dict, low_dict = return_period_highlow(stockcodelist, period_days=period_days)
        highresult_list, lowresult_list = test_last_day_stock_price(
            stockcodelist, high_dict, low_dict, analysis_date)
            
        # 显示结果
        self.high_result.clear()
        self.low_result.clear()
        
        if highresult_list:
            self.high_result.append(f"<h3>创{period_days}日新高股票 ({len(highresult_list)}只)</h3>")
            self.high_result.append(f"分析日期: {analysis_date}")
            self.high_result.append("<hr>")
            for code in highresult_list:
                self.high_result.append(f"<br>{code}<br>")
        else:
            self.high_result.append(f"<h3>没有股票创{period_days}日新高</h3>")
            self.high_result.append("<hr>")
            
        if lowresult_list:
            self.low_result.append(f"<h3>创{period_days}日新低股票 ({len(lowresult_list)}只)</h3>")
            self.low_result.append(f"分析日期: {analysis_date}")
            self.low_result.append("<hr>")
            for code in lowresult_list:
                self.low_result.append(f"<br>{code}<br>")
        else:
            self.low_result.append(f"<h3>没有股票创{period_days}日新低</h3>")
            self.low_result.append("<hr>")
            
    def reset_highlow_tab(self):
        """重置高低点分析标签页"""
        self.high_result.clear()
        self.low_result.clear()
    
    def add_signal_tab(self):
        """指数轮动信号标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 信号获取按钮
        self.signal_btn = QPushButton("获取信号")
        self.signal_btn.clicked.connect(self.get_index_signal)
        control_layout.addWidget(self.signal_btn)
        
        # 重置按钮
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(self.reset_signal_tab)
        control_layout.addWidget(reset_btn)
        
        layout.addLayout(control_layout)
        
        # 信号显示
        self.signal_label = QLabel("信号将显示在这里")
        self.signal_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.signal_label)
        
        # 创建滚动区域
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        
        # 图表区域
        self.signal_figure = plt.figure(figsize=(10, 8))  # 固定尺寸
        self.signal_canvas = FigureCanvas(self.signal_figure)
        scroll.setWidget(self.signal_canvas)
        
        layout.addWidget(scroll)
        tab.setLayout(layout)
        self.tabs.addTab(tab, "指数轮动信号")
        
    def reset_signal_tab(self):
        """重置信号标签页"""
        self.signal_label.setText("信号将显示在这里")
        self.signal_figure.clear()
        self.signal_canvas.draw()
    
    def get_index_signal(self):
        """获取指数轮动信号"""
        result = index_signal_wind()
        if result:
            self.signal_label.setText(f"当前信号: {result['signal']}")
            
            # 设置图形尺寸为11x7英寸
            self.signal_figure.set_size_inches(11, 7)
            self.signal_figure.clear()
            
            # 创建两个子图并调整间距
            gs = self.signal_figure.add_gridspec(2, 1, height_ratios=[1, 1], 
                                      hspace=0.4, left=0.1, right=0.9, 
                                      bottom=0.1, top=0.9)
            ax1 = self.signal_figure.add_subplot(gs[0])
            ax2 = self.signal_figure.add_subplot(gs[1])
            
            # 绘制价格图表
            ax1.plot(result['dates'], result['hs300_prices'], label='沪深300')
            ax1.plot(result['dates'], result['zz500_prices'], label='中证500')
            ax1.plot(result['dates'], result['zz1000_prices'], label='中证1000')
            ax1.set_title('指数价格走势对比')
            ax1.set_ylabel('价格')
            ax1.legend()
            ax1.grid(True)
            
            # 绘制增长率图表
            ax2.plot(result['dates'], result['hs300_growth'], label='沪深300')
            ax2.plot(result['dates'], result['zz500_growth'], label='中证500') 
            ax2.plot(result['dates'], result['zz1000_growth'], label='中证1000')
            # 添加 0 线
            ax2.axhline(y=0, color='r', linestyle='--', label='0线')
            ax2.set_title('指数环比25日变动(%)')
            ax2.set_ylabel('增长率(%)')
            ax2.legend()
            ax2.grid(True)
            
            # 调整布局防止标签被截断
            self.signal_figure.tight_layout(pad=2.0)
            # 旋转x轴标签
            plt.setp(ax1.get_xticklabels(), rotation=45, ha='right')
            plt.setp(ax2.get_xticklabels(), rotation=45, ha='right')
            self.signal_canvas.draw()
    
    def add_valuation_tab(self):
        """估值分析标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 指数选择
        control_layout.addWidget(QLabel("选择指数:"))
        self.val_combo = QComboBox()
        self.val_combo.addItems(["000016.SH", "000300.SH", "000905.SH", "000852.SH"])
        control_layout.addWidget(self.val_combo)
        
        # 回测年份
        control_layout.addWidget(QLabel("回测年份:"))
        self.years_spin = QSpinBox()
        self.years_spin.setRange(1, 20)  # 1-10年范围
        self.years_spin.setValue(10)      # 默认5年
        control_layout.addWidget(self.years_spin)
        
        # 分析按钮
        self.val_btn = QPushButton("分析估值")
        self.val_btn.clicked.connect(self.run_valuation_analysis)
        control_layout.addWidget(self.val_btn)
        
        # 重置按钮
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(self.reset_valuation_tab)
        control_layout.addWidget(reset_btn)
        
        layout.addLayout(control_layout)
        
        # 结果显示
        self.val_figure = plt.figure()
        self.val_canvas = FigureCanvas(self.val_figure)
        layout.addWidget(self.val_canvas)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "估值分析")
        
    def reset_valuation_tab(self):
        """重置估值标签页"""
        self.val_figure.clear()
        self.val_canvas.draw()
    
    def run_valuation_analysis(self):
        """执行估值分析(10年)"""
        valuation_code = self.val_combo.currentText()
        years = self.years_spin.value()
        result = monitor_index_valuation(valuation_code, years=years)
        
        if result and 'data' in result:
            # 清除现有图表
            self.val_figure.clear()
            
            # 设置图形尺寸为11x7英寸 (与信号标签页一致)
            self.val_figure.set_size_inches(11, 7)
            
            # 创建子图布局 (3个子图)
            gs = self.val_figure.add_gridspec(2, 1, height_ratios=[1, 1])
            ax1 = self.val_figure.add_subplot(gs[0])
            ax2 = self.val_figure.add_subplot(gs[1])
            
            # 绘制PE时间序列
            ax1.plot(result['data'].index, result['data']['PE'], 
                    label=f'PE (当前: {result["PE"]:.2f})', color='blue')
            ax1.plot(result['data'].index, result['data']['PE_60MA'], 
                    label='60日移动平均', color='orange', linestyle='--')
            
            # 添加PE布林带
            if 'PE_UpperBand' in result['data'].columns and 'PE_LowerBand' in result['data'].columns:
                ax1.plot(result['data'].index, result['data']['PE_UpperBand'], 
                        label='PE上轨', color='red', linestyle='--')
                ax1.plot(result['data'].index, result['data']['PE_LowerBand'], 
                        label='PE下轨', color='green', linestyle='--')
            
            # 添加PE趋势线
            if 'PE' in result['trend_params']:
                x = np.arange(len(result['data']))
                trend = result['trend_params']['PE']['slope'] * x + \
                        result['trend_params']['PE']['intercept']
                ax1.plot(result['data'].index, trend, 
                        label='趋势线', color='green', linestyle=':')
            
            ax1.set_title(f'{valuation_code} PE分析 ({years}年)')
            ax1.set_ylabel('PE')
            ax1.legend()
            ax1.grid(True)
            
            # 绘制PB时间序列
            ax2.plot(result['data'].index, result['data']['PB'], 
                    label=f'PB (当前: {result["PB"]:.2f})', color='red')
            ax2.plot(result['data'].index, result['data']['PB_60MA'], 
                    label='60日移动平均', color='purple', linestyle='--')
            
            # 添加PB布林带（假设之前已在valuation.py中计算）
            if 'PB_UpperBand' in result['data'].columns and 'PB_LowerBand' in result['data'].columns:
                ax2.plot(result['data'].index, result['data']['PB_UpperBand'], 
                        label='PB上轨', color='red', linestyle='--')
                ax2.plot(result['data'].index, result['data']['PB_LowerBand'], 
                        label='PB下轨', color='green', linestyle='--')
            
            # 添加PB趋势线
            if 'PB' in result['trend_params']:
                x = np.arange(len(result['data']))
                trend = result['trend_params']['PB']['slope'] * x + \
                        result['trend_params']['PB']['intercept']
                ax2.plot(result['data'].index, trend, 
                        label='趋势线', color='cyan', linestyle=':')
            
            ax2.set_title(f'{valuation_code} PB分析 ({years}年)')
            ax2.set_ylabel('PB')
            ax2.legend()
            ax2.grid(True)
            
            
            # 调整布局防止标签被截断
            self.val_figure.tight_layout(pad=2.0)
            
            # 显示估值信息
            info = f"分析周期: {result['analysis_period']}\n\n" \
                  f"PE: {result['PE']:.2f} (分位数: {result['PE_Quantile']:.1%})\n" \
                  f"PB: {result['PB']:.2f} (分位数: {result['PB_Quantile']:.1%})"
            self.val_canvas.draw()
            QMessageBox.information(self, "估值信息", info)            
            
    
    def add_volatility_tab(self):
        """波动率分析标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 参数设置
        param_layout = QHBoxLayout()
        param_layout.addWidget(QLabel("选择指数:"))
        self.vol_combo = QComboBox()
        self.vol_combo.addItems(["000016.SH", "000300.SH", "000905.SH", "000852.SH"])
        param_layout.addWidget(self.vol_combo)
        
        param_layout.addWidget(QLabel("窗口(日):"))
        self.window_spin = QSpinBox()
        self.window_spin.setRange(5, 60)
        self.window_spin.setValue(20)
        param_layout.addWidget(self.window_spin)
        
        # 分析按钮
        self.vol_btn = QPushButton("分析波动率")
        self.vol_btn.clicked.connect(self.run_volatility_analysis)
        param_layout.addWidget(self.vol_btn)
        
        # 重置按钮
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(self.reset_volatility_tab)
        param_layout.addWidget(reset_btn)
        
        layout.addLayout(param_layout)
        
        # 图表区域
        self.vol_figure = plt.figure()
        self.vol_canvas = FigureCanvas(self.vol_figure)
        layout.addWidget(self.vol_canvas)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "波动率分析")
        
    def reset_volatility_tab(self):
        """重置波动率标签页"""
        self.vol_figure.clear()
        self.vol_canvas.draw()
    
    def run_volatility_analysis(self):
        """执行波动率分析"""
        windcode = self.vol_combo.currentText()
        window = self.window_spin.value()
        result = get_volatility_analysis(windcode, window=window)
        if result:
            # 清除现有图表
            self.vol_figure.clear()
            
            # 设置图形尺寸为11.7x8英寸(与信号标签页一致)
            self.vol_figure.set_size_inches(11.7, 8)
            
            # 创建子图布局 (增加边距参数)
            gs = self.vol_figure.add_gridspec(2, 1, height_ratios=[3, 1],
                                  left=0.1, right=0.9, bottom=0.1, top=0.9)
            ax1 = self.vol_figure.add_subplot(gs[0])
            ax2 = self.vol_figure.add_subplot(gs[1])
            
            # 调整子图间距
            plt.subplots_adjust(hspace=0.3)
            
            # 绘制波动率时间序列
            ax1.plot(result['dates'], result['volatility_data'], 
                    label=f'波动率 (当前: {result["current_hv"]:.2f}%)', color='blue')
            ax1.plot(result['dates'], result['volatility_60MA'], 
                    label='60日移动平均', color='orange', linestyle='--')
            
            # 添加趋势线
            if result['trend_params']:
                x = np.arange(len(result['dates']))
                trend = result['trend_params']['volatility']['slope'] * x + \
                        result['trend_params']['volatility']['intercept']
                ax1.plot(result['dates'], trend, 
                        label='趋势线', color='green', linestyle=':')
            
            ax1.set_title(f'{windcode} 波动率分析 ({window}日窗口)')
            ax1.set_ylabel('波动率 (%)')
            ax1.legend()
            ax1.grid(True)
            
            # 绘制波动率分布直方图
            ax2.hist(result['volatility_data'].dropna(), bins=30, 
                    color='blue', alpha=0.7)
            ax2.axvline(result['current_hv'], color='red', 
                       linestyle='--', label='当前值')
            ax2.set_xlabel('波动率 (%)')
            ax2.set_ylabel('频率')
            ax2.legend()
            
            # 调整布局
            self.vol_figure.tight_layout()
            
            # 显示关键指标
            info = f"分析周期: {result['analysis_period']}\n\n" \
                  f"当前波动率: {result['current_hv']:.2f}%\n" \
                  f"长期平均: {result['long_term_hv']:.2f}%\n" \
                  f"变化值: {result['hv_change']:+.2f}%\n" \
                  f"历史百分位: {result['hv_percentile']:.1f}%"
            self.vol_canvas.draw()
            QMessageBox.information(self, "波动率指标", info)
            
            



    def add_gold_tab(self):
        """黄金现货实时行情标签页"""
        self.gold_tab_index = add_market_tab(
            "黄金现货行情",
            GoldRealtime,
            "gold_table",
            "gold_figure",
            "gold_canvas",
            "gold_monitor_btn",
            "gold_subscribed",
            update_market_display,
            self
        )

    def add_btc_tab(self):
        """比特币实时行情标签页"""
        self.btc_tab_index = add_market_tab(
            "比特币行情",
            BtcRealtime,
            "btc_table",
            "btc_figure",
            "btc_canvas",
            "btc_monitor_btn",
            "btc_subscribed",
            update_market_display,
            self
        )

    # 其他类似的实时行情标签页方法也需要做同样的修改
    def add_A50_tab(self):
        """A50实时行情标签页"""
        self.A50_tab_index = add_market_tab(
            "A50行情",
            A50Realtime,
            "A50_table",
            "A50_figure",
            "A50_canvas",
            "A50_monitor_btn",
            "A50_subscribed",
            update_market_display,
            self
        )

    def add_uc00_tab(self):
        """人民币美元离岸汇率实时行情标签页"""
        self.uc00_tab_index = add_market_tab(
            "人民币美元离岸汇率行情",
            Uc00Realtime,
            "uc00_table",
            "uc00_figure",
            "uc00_canvas",
            "uc00_monitor_btn",
            "uc00_subscribed",
            update_market_display,
            self
        )

    def add_nq_tab(self):
        """纳斯达克 100 实时行情标签页"""
        self.nq_tab_index = add_market_tab(
            "纳斯达克 100 行情",
            NqRealtime,
            "nq_table",
            "nq_figure",
            "nq_canvas",
            "nq_monitor_btn",
            "nq_subscribed",
            update_market_display,
            self
        )

    def add_es_tab(self):
        """标普 500 实时行情标签页"""
        self.es_tab_index = add_market_tab(
            "标普 500 行情",
            EsRealtime,
            "es_table",
            "es_figure",
            "es_canvas",
            "es_monitor_btn",
            "es_subscribed",
            update_market_display,
            self
        )

    def add_ym_tab(self):
        """道琼斯指数股指期货实时行情标签页"""
        self.ym_tab_index = add_market_tab(
            "道琼斯指数股指期货行情",
            YmRealtime,
            "ym_table",
            "ym_figure",
            "ym_canvas",
            "ym_monitor_btn",
            "ym_subscribed",
            update_market_display,
            self
        )

    def add_volume_tab(self):
        """成交分析标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 刷新按钮
        self.vol_refresh = QPushButton("提取数据")
        self.vol_refresh.clicked.connect(self.run_volume_analysis)
        control_layout.addWidget(self.vol_refresh)
        
        # 重置按钮
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(self.reset_volume_tab)
        control_layout.addWidget(reset_btn)
        
        layout.addLayout(control_layout)
        
        # 图表区域
        self.volume_figure = plt.figure()
        self.volume_canvas = FigureCanvas(self.volume_figure)
        layout.addWidget(self.volume_canvas)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "沪深两市成交分析")
        
    def reset_volume_tab(self):
        """重置成交分析标签页"""
        self.vol_figure.clear()
        self.vol_canvas.draw()

    def run_volume_analysis(self):
        """执行成交分析"""
        # Create worker thread for volume data
        self.volume_worker = VolumeWorker()
        self.volume_worker.data_ready.connect(self.update_volume_display)
        self.volume_worker.start()
        
    def update_volume_display(self, data):
        """更新成交分析显示"""
        if not data or 'error' in data:
            self.volume_figure.clear()
            ax = self.volume_figure.add_subplot(111)
            ax.text(0.5, 0.5, '无有效数据', ha='center', va='center')
            self.volume_canvas.draw()
            return
            
        try:
            self.volume_figure.clear()
            
            # 定义交易时间段 (9:30-11:30 和 13:00-15:00) - 分钟级
            morning_times = [f"09:{m:02d}" for m in range(30, 60)] + \
                          [f"10:{m:02d}" for m in range(0, 60)] + \
                          [f"11:{m:02d}" for m in range(0, 31)]
            
            afternoon_times = [f"13:{m:02d}" for m in range(0, 60)] + \
                            [f"14:{m:02d}" for m in range(0, 60)] + \
                            ["15:00"]
            
            full_times = morning_times + afternoon_times
            
            # 对齐数据到固定时间点
            aligned_today = []
            aligned_yesterday = [] 
            aligned_today_cum = []
            aligned_yesterday_cum = []
            aligned_diff = []
            
            current_time = datetime.datetime.now().strftime('%H:%M')
            for t in full_times:
                if t > current_time:
                    break  # 不显示未来时间点
                    
                idx = data['times'].index(t) if t in data['times'] else -1
                if idx >= 0:
                    aligned_today.append(data['today'][idx])
                    aligned_yesterday.append(data['yesterday'][idx])
                    aligned_today_cum.append(data['today_cumulative'][idx])
                    aligned_yesterday_cum.append(data['yesterday_cumulative'][idx])
                    aligned_diff.append(data['diff'][idx])
                else:
                    aligned_today.append(0)
                    aligned_yesterday.append(0)
                    aligned_today_cum.append(0)
                    aligned_yesterday_cum.append(0)
                    aligned_diff.append(0)
            
            # 创建单个图表
            self.volume_figure.set_size_inches(12, 7)
            ax = self.volume_figure.add_subplot(111)
            
            # 绘制累计成交额（折线图）
            ax.plot(full_times[:len(aligned_today_cum)], aligned_today_cum, 'b-', label='今日累计', linewidth=2)
            ax.plot(full_times[:len(aligned_today_cum)], aligned_yesterday_cum, 'g-', label='昨日累计', linewidth=2)
            ax.set_xlabel('时间')
            ax.set_ylabel('累计成交额 (亿元)', color='b')
            ax.set_title('沪深两市成交分析')
            ax.grid(True)
            
            # 创建第二个y轴用于差额柱状图
            ax2 = ax.twinx()
            ax2.bar(full_times[:len(aligned_diff)], aligned_diff, 
                   color=['m' if x >=0 else 'r' for x in aligned_diff],
                   alpha=0.5, label='成交额差额')
            ax2.axhline(0, color='gray', linestyle='--')
            ax2.set_ylabel('成交额差额 (亿元)', color='m')
            
            # 合并图例
            lines, labels = ax.get_legend_handles_labels()
            bars, bar_labels = ax2.get_legend_handles_labels()
            ax.legend(lines + bars, labels + bar_labels, loc='upper left')
            
            # 自动调整x轴标签间隔
            if len(full_times) > 30:  # 如果数据 много于30个
                ax.xaxis.set_major_locator(plt.MaxNLocator(10))  # 只显示10个主要刻度
            # 旋转x轴标签
            plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
            # 调整布局防止标签被截断
            self.volume_figure.tight_layout(pad=2.0)
            self.volume_canvas.draw()
            
        except Exception as e:
            self.volume_figure.clear()
            ax = self.volume_figure.add_subplot(111)
            ax.text(0.5, 0.5, f'图表错误: {str(e)}', ha='center', va='center')
            self.volume_canvas.draw()

    def add_composite_board_tab(self):
        """添加综合行情看板"""
        try:
            tab = QWidget()
            layout = QVBoxLayout()
            
            # 创建表格（修改列数为5并新增时间列）
            self.composite_table = QTableWidget()
            self.composite_table.setRowCount(6)
            self.composite_table.setColumnCount(5)
            self.composite_table.setHorizontalHeaderLabels(['品种', '时间', '最新价', '涨跌额', '涨跌幅'])
            
                    # 设置初始列宽
            self.composite_table.setColumnWidth(0, 150)  # 品种列
            self.composite_table.setColumnWidth(1, 150)  # 时间列
            self.composite_table.setColumnWidth(2, 150)  # 最新价列
            self.composite_table.setColumnWidth(3, 150)  # 涨跌额列
            self.composite_table.setColumnWidth(4, 150)  # 涨跌幅列

            # 初始化表格数据（新增时间列）
            instruments = ['A50', '道琼斯', '纳斯达克', 'BTC', '黄金', 'UC00']
            for i, instrument in enumerate(instruments):
                self.composite_table.setItem(i, 0, QTableWidgetItem(instrument))
                self.composite_table.setItem(i, 1, QTableWidgetItem('--:--:--'))
                self.composite_table.setItem(i, 2, QTableWidgetItem('加载中...'))
                self.composite_table.setItem(i, 3, QTableWidgetItem('加载中...'))
                self.composite_table.setItem(i, 4, QTableWidgetItem('加载中...'))
            
            layout.addWidget(self.composite_table)
            tab.setLayout(layout)
            self.tabs.addTab(tab, "综合行情看板")
            
            # 初始化实时数据处理器
            self.realtime_handlers = {
                'A50': A50Realtime(),
                '道琼斯': YmRealtime(),
                '纳斯达克': NqRealtime(),
                'BTC': BtcRealtime(),
                '黄金': GoldRealtime(),
                'UC00': Uc00Realtime()
            }
            
            # 注册回调并启动
            for name, handler in self.realtime_handlers.items():
                handler.register_callback(lambda data, n=name: self._update_composite_row(n, data))
                handler.start()
                
        except Exception as e:
            QMessageBox.critical(self, "初始化错误", f"无法初始化综合行情看板:\n{str(e)}")
    
    def _update_composite_row(self, name, data):
        """更新单个品种的行数据"""
        try:
            if not data or 'close' not in data or not data['close']:
                return
                
            # 获取当前日期和时间
            today = datetime.datetime.now().strftime('%Y-%m-%d')
            time_str = data['time'][-1] if 'time' in data and data['time'] else '--:--:--'
            
            # 根据品种获取对应的Wind代码
            wind_codes = {
                'A50': 'CN.SG',
                '道琼斯': 'YM.CBT',
                '纳斯达克': 'NQ.CME',
                'BTC': 'BTC.CME',
                '黄金': 'GC.CMX',
                'UC00': 'UC00.SG'
            }
            
            # 获取昨日收盘价
            if not hasattr(self, 'pre_close_data') or today not in self.pre_close_data:
                if not hasattr(self, 'pre_close_data'):
                    self.pre_close_data = {}
                
                # 批量获取所有品种的昨日收盘价
                codes = ",".join(wind_codes.values())
                w.start()
                pre_close = w.wsd(codes, "pre_close", today, today, "")
                
                if pre_close.ErrorCode == 0:
                    for i, code in enumerate(wind_codes.values()):
                        instrument = list(wind_codes.keys())[i]
                        self.pre_close_data[instrument] = pre_close.Data[0][i] if pre_close.Data[0][i] else 0
                else:
                    # 如果获取失败，使用默认值
                    for instrument in wind_codes.keys():
                        self.pre_close_data[instrument] = 0
            row = list(self.realtime_handlers.keys()).index(name)
            latest_price = data['close'][-1] if data['close'] else 0
            pre_close = self.pre_close_data.get(name, 0)
            
            # 计算涨跌额和涨跌幅
            chg = latest_price - pre_close
            pct_chg = (chg / pre_close * 100) if pre_close != 0 else 0
            
            # 格式化数据
            price = f"{latest_price:.2f}" if isinstance(latest_price, (int, float)) else "N/A"
            chg_str = f"{chg:.2f}" if isinstance(chg, (int, float)) else "N/A"
            pct_str = f"{pct_chg:.2f}%" if isinstance(pct_chg, (int, float)) else "N/A"
            
            # 创建带颜色的表格项
            def create_colored_item(text, value):
                item = QTableWidgetItem(text)
                if isinstance(value, (int, float)):
                    if value > 0:
                        item.setForeground(QColor(255, 0, 0))  # 红色
                    elif value < 0:
                        item.setForeground(QColor(0, 255, 0))  # 绿色
                return item
            
            # 更新表格（使用带颜色的项）
            self.composite_table.setItem(row, 0, QTableWidgetItem(name))
            self.composite_table.setItem(row, 1, QTableWidgetItem(time_str))
            self.composite_table.setItem(row, 2, create_colored_item(price, chg))
            self.composite_table.setItem(row, 3, create_colored_item(chg_str, chg))
            self.composite_table.setItem(row, 4, create_colored_item(pct_str, pct_chg))
            
        except Exception as e:
            print(f"更新{name}数据出错: {str(e)}")
            
class VolumeWorker(QThread):
    data_ready = pyqtSignal(dict)
    
    def run(self):
        """在后台线程中获取成交数据"""
        try:
            data = get_combined_volume_data()
            self.data_ready.emit(data)
        except Exception as e:
            self.data_ready.emit({'error': str(e)})







if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = FinancialAnalysisApp()
    window.show()
    sys.exit(app.exec_())