import sys
from PyQt5.QtWidgets import (QApplication, QMainWindow, QTabWidget, QWidget, 
                            QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
                            QDateEdit, QComboBox, QTextEdit, QScrollArea, 
                            QSpinBox, QMessageBox)
from PyQt5.QtCore import QDate, Qt, QThread, pyqtSignal
import datetime
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib import rcParams
# 设置中文字体
rcParams['font.sans-serif'] = ['PingFang SC', 'SimHei', 'Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS']  # 支持中文的字体列表
rcParams['axes.unicode_minus'] = False  # 用来正常显示负号
from financial_tools.stock_analysis import (
    getstocklist, return_60dayhighlow, 
    test_last_day_stock_price, highlowautoeye
)
from financial_tools.index_signals import index_signal_wind
from financial_tools.volatility import get_volatility_analysis
from financial_tools.valuation import monitor_index_valuation
from financial_tools.tradingvolume_realtime import get_combined_volume_data

from financial_tools.gold_realtime import GoldRealtime
from financial_tools.A50_realtime import A50Realtime
class FinancialAnalysisApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("金融数据分析平台")
        self.setGeometry(100, 100, 1200, 800)
        
        # Create main tab widget
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)
        
        # Add tabs
        self.add_highlow_tab()
        self.add_signal_tab() 
        self.add_valuation_tab()
        self.add_volatility_tab()
        self.add_volume_tab()
        self.add_gold_tab()
        self.add_A50_tab()
        
    def add_highlow_tab(self):
        """股票高低点分析标签页"""
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 指数选择
        control_layout.addWidget(QLabel("选择指数:"))
        self.index_combo = QComboBox()
        self.index_combo.addItems(["000016.SH", "000300.SH", "000905.SH", "000852.SH", "932000.CSI"])
        control_layout.addWidget(self.index_combo)
        
        # 日期选择
        control_layout.addWidget(QLabel("分析日期:"))
        self.date_edit = QDateEdit(QDate.currentDate())
        control_layout.addWidget(self.date_edit)
        
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
        result_layout.addWidget(self.high_result)
        
        self.low_result = QTextEdit() 
        self.low_result.setReadOnly(True)
        result_layout.addWidget(self.low_result)
        
        layout.addLayout(result_layout)
        
        tab.setLayout(layout)
        self.tabs.addTab(tab, "股票高低点分析")
        
    def run_highlow_analysis(self):
        """执行高低点分析"""
        index_code = self.index_combo.currentText()
        analysis_date = self.date_edit.date().toString("yyyy-MM-dd")
        
        # 获取股票列表
        stockcodelist = getstocklist(index_code)
        
        # 计算高低点
        summit60daydict, trough60daydict = return_60dayhighlow(stockcodelist)
        highresult_list, lowresult_list = test_last_day_stock_price(
            stockcodelist, summit60daydict, trough60daydict, analysis_date)
            
        # 显示结果
        self.high_result.clear()
        self.low_result.clear()
        
        if highresult_list:
            self.high_result.append(f"创60日新高股票 ({len(highresult_list)}只) - 分析日期: {analysis_date}")
            for code in highresult_list:
                self.high_result.append(f"- {code}")
        else:
            self.high_result.append("没有股票创60日新高")
            
        if lowresult_list:
            self.low_result.append(f"创60日新低股票 ({len(lowresult_list)}只) - 分析日期: {analysis_date}")
            for code in lowresult_list:
                self.low_result.append(f"- {code}")
        else:
            self.low_result.append("没有股票创60日新低")
            
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
        self.years_spin.setRange(1, 10)  # 1-10年范围
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

    def add_gold_tab(self):
        """黄金现货实时行情标签页"""
        try:
            tab = QWidget()
            layout = QVBoxLayout()
            
            # 创建结果显示区域
            self.gold_table = QTextEdit()
            self.gold_table.setReadOnly(True)
            layout.addWidget(self.gold_table)
            
            # 控制区域
            control_layout = QHBoxLayout()
            self.monitor_btn = QPushButton("开启监控")
            self.monitor_btn.clicked.connect(self.toggle_gold_monitoring)
            control_layout.addWidget(self.monitor_btn)
            
            reset_btn = QPushButton("重置")
            reset_btn.clicked.connect(self.reset_gold_tab)
            control_layout.addWidget(reset_btn)
            layout.addLayout(control_layout)
            
            # 图表区域
            self.gold_figure = plt.figure()
            self.gold_canvas = FigureCanvas(self.gold_figure)
            layout.addWidget(self.gold_canvas)
            tab.setLayout(layout)
            self.gold_tab_index = self.tabs.addTab(tab, "黄金现货行情")
            
            # 初始化黄金实时数据对象
            self.gold_table.append("黄金行情接口准备就绪")
            from WindPy import w
            if not w.isconnected():
                w.start()
                
            self.gold_realtime = GoldRealtime()
            self.gold_realtime.register_callback(self.update_gold_display)
            
        except Exception as e:
            import traceback
            error_msg = f"初始化黄金行情标签页时出错:\n{str(e)}\n{traceback.format_exc()}"
            print(error_msg)  # 控制台输出
            QMessageBox.critical(self, "初始化错误", f"无法初始化黄金行情:\n{str(e)}")
    
    def reset_gold_tab(self):
        """重置黄金行情标签页"""
        self.gold_figure.clear()
        self.gold_canvas.draw()
        self.gold_table.clear()
        if hasattr(self, 'gold_subscribed') and self.gold_subscribed:
            self.toggle_gold_subscription()  # 取消订阅
    
    def handle_tab_changed(self, index):
        """处理标签页切换事件"""
        if hasattr(self, 'gold_tab_index') and index == self.gold_tab_index:
            # 切换到黄金标签页时自动开始
            if not hasattr(self, 'gold_subscribed') or not self.gold_subscribed:
                self.start_gold_updates()
                self.monitor_btn.setText("停止监控")
        elif hasattr(self, 'gold_subscribed') and self.gold_subscribed:
            # 切换到其他标签页时自动停止
            self.stop_gold_updates()
            self.monitor_btn.setText("开启监控")
            
    def toggle_gold_monitoring(self):
        """切换黄金监控状态"""
        if not hasattr(self, 'gold_subscribed'):
            self.gold_subscribed = False
            
        if not self.gold_subscribed:
            self.start_gold_updates()
            self.monitor_btn.setText("停止监控")
        else:
            self.stop_gold_updates()
            self.monitor_btn.setText("开启监控")
            
    def start_gold_updates(self):
        """启动黄金行情更新"""
        try:
            from WindPy import w
            if not w.isconnected():
                w.start()
                if not w.isconnected():
                    raise ConnectionError("WindPy连接失败")
            
            self.gold_subscribed = True
            self.gold_realtime.start()
            self.gold_table.append("黄金行情监控已启动...")
            
        except Exception as e:
            self.gold_table.append(f"启动失败: {str(e)}")
            self.gold_subscribed = False
            QMessageBox.critical(self, "错误", f"启动黄金行情失败:\n{str(e)}")
            
    def stop_gold_updates(self):
        """停止黄金行情更新"""
        if hasattr(self, 'gold_subscribed') and self.gold_subscribed:
            self.gold_realtime.stop()
            self.gold_subscribed = False
            self.gold_table.append("黄金行情监控已停止")
    
    def update_gold_display(self, data):
        """更新黄金行情显示"""
        try:
            if not data or not isinstance(data, dict):
                self.gold_table.append("无效数据格式")
                return
                
            # 验证数据字段
            required_fields = ['time', 'close', 'chg', 'pct_chg']
            if not all(field in data for field in required_fields):
                self.gold_table.append("数据字段不完整")
                return
                
            if not data['time']:
                self.gold_table.append("无有效时间数据")
                return
                
            # 获取最新数据点
            try:
                latest_time = data['time'][-1] if data['time'] else "N/A"
                latest_close = data['close'][-1] if data['close'] else "N/A"
                latest_chg = data['chg'][-1] if data['chg'] else "N/A"
                latest_pct = data['pct_chg'][-1] if data['pct_chg'] else "N/A"
            except (IndexError, TypeError) as e:
                self.gold_table.append(f"数据解析错误: {str(e)}")
                return
                
            # 更新图表
            try:
                self.gold_figure.clear()
                ax = self.gold_figure.add_subplot(111)
                
                if data['time'] and data['close']:
                    ax.plot(data['time'], data['close'], label=f'价格 (最新: {latest_close})')
                    ax.set_title(f'黄金现货价格走势 (纽约时间 {latest_time})')
                    ax.set_ylabel('价格')
                    ax.legend()
                    ax.grid(True)
                
                # Auto-format date labels based on time range
                if len(data['time']) > 0:
                    time_range = len(data['time'])
                    if time_range > 20:  # Long time range - show fewer labels
                        ax.xaxis.set_major_locator(plt.MaxNLocator(6))
                    plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
                
                # Adjust layout with padding
                self.gold_figure.tight_layout(pad=2.0, h_pad=1.0)
                self.gold_canvas.draw()
            except Exception as e:
                self.gold_table.append(f"图表更新失败: {str(e)}")
                
            # 更新数据表格
            self.gold_table.clear()
            self.gold_table.append("=== 黄金现货实时数据 ===")
            self.gold_table.append(f"更新时间(北京): {latest_time}")
            self.gold_table.append(f"最新价格: {latest_close}")
            self.gold_table.append(f"涨跌额: {latest_chg}")
            self.gold_table.append(f"涨跌幅: {latest_pct}")
            
            if data['time'] and data['close'] and data['chg'] and data['pct_chg']:
                self.gold_table.append("\n=== 历史数据 ===")
                # 显示最近5条数据
                for i in range(min(10, len(data['time']))):
                    idx = -1 - i  # 从最新到最旧
                    self.gold_table.append(
                        f"{data['time'][idx]} | 价格: {data['close'][idx]} | "
                        f"涨跌: {data['chg'][idx]} | 涨跌幅: {data['pct_chg'][idx]}"
                    )
                    
        except Exception as e:
            import traceback
            error_msg = f"更新显示时出错:\n{str(e)}\n{traceback.format_exc()}"
            print(error_msg)
            self.gold_table.append("处理数据时发生错误")

    def add_A50_tab(self):
        """A50 实时行情标签页"""
        try:
            tab = QWidget()
            layout = QVBoxLayout()
            
            # 创建结果显示区域
            self.A50_table = QTextEdit()
            self.A50_table.setReadOnly(True)
            layout.addWidget(self.A50_table)
            
            # 控制区域
            control_layout = QHBoxLayout()
            self.A50_monitor_btn = QPushButton("开启监控")
            self.A50_monitor_btn.clicked.connect(self.toggle_A50_monitoring)
            control_layout.addWidget(self.A50_monitor_btn)
            
            reset_btn = QPushButton("重置")
            reset_btn.clicked.connect(self.reset_A50_tab)
            control_layout.addWidget(reset_btn)
            layout.addLayout(control_layout)
            
            # 图表区域
            self.A50_figure = plt.figure()
            self.A50_canvas = FigureCanvas(self.A50_figure)
            layout.addWidget(self.A50_canvas)
            tab.setLayout(layout)
            self.A50_tab_index = self.tabs.addTab(tab, "A50 实时行情")
            
            # 初始化 A50 实时数据对象
            self.A50_table.append("A50 行情接口准备就绪")
            from WindPy import w
            if not w.isconnected():
                w.start()
                
            self.A50_realtime = A50Realtime()
            self.A50_realtime.register_callback(self.update_A50_display)
            
        except Exception as e:
            import traceback
            error_msg = f"初始化 A50 行情标签页时出错:\n{str(e)}\n{traceback.format_exc()}"
            print(error_msg)  # 控制台输出
            QMessageBox.critical(self, "初始化错误", f"无法初始化 A50 行情:\n{str(e)}")
    
    def reset_A50_tab(self):
        """重置 A50 行情标签页"""
        self.A50_figure.clear()
        self.A50_canvas.draw()
        self.A50_table.clear()
        if hasattr(self, 'A50_subscribed') and self.A50_subscribed:
            self.toggle_A50_subscription()  # 取消订阅
    
    def handle_tab_changed(self, index):
        """处理标签页切换事件"""
        if hasattr(self, 'A50_tab_index') and index == self.A50_tab_index:
            # 切换到 A50 标签页时自动开始
            if not hasattr(self, 'A50_subscribed') or not self.A50_subscribed:
                self.start_A50_updates()
                self.A50_monitor_btn.setText("停止监控")
        elif hasattr(self, 'A50_subscribed') and self.A50_subscribed:
            # 切换到其他标签页时自动停止
            self.stop_A50_updates()
            self.A50_monitor_btn.setText("开启监控")
            
    def toggle_A50_monitoring(self):
        """切换 A50 监控状态"""
        if not hasattr(self, 'A50_subscribed'):
            self.A50_subscribed = False
            
        if not self.A50_subscribed:
            self.start_A50_updates()
            self.A50_monitor_btn.setText("停止监控")
        else:
            self.stop_A50_updates()
            self.A50_monitor_btn.setText("开启监控")
            
    def start_A50_updates(self):
        """启动 A50 行情更新"""
        try:
            from WindPy import w
            if not w.isconnected():
                w.start()
                if not w.isconnected():
                    raise ConnectionError("WindPy连接失败")
            
            self.A50_subscribed = True
            self.A50_realtime.start()
            self.A50_table.append("A50 行情监控已启动...")
            
        except Exception as e:
            self.A50_table.append(f"启动失败: {str(e)}")
            self.A50_subscribed = False
            QMessageBox.critical(self, "错误", f"启动 A50 行情失败:\n{str(e)}")
            
    def stop_A50_updates(self):
        """停止 A50 行情更新"""
        if hasattr(self, 'A50_subscribed') and self.A50_subscribed:
            self.A50_realtime.stop()
            self.A50_subscribed = False
            self.A50_table.append("A50 行情监控已停止")
    
    def update_A50_display(self, data):
        """更新 A50 行情显示"""
        try:
            if not data or not isinstance(data, dict):
                self.A50_table.append("无效数据格式")
                return
                
            # 验证数据字段
            required_fields = ['time', 'close', 'chg', 'pct_chg']
            if not all(field in data for field in required_fields):
                self.A50_table.append("数据字段不完整")
                return
                
            if not data['time']:
                self.A50_table.append("无有效时间数据")
                return
                
            # 获取最新数据点
            try:
                latest_time = data['time'][-1] if data['time'] else "N/A"
                latest_close = data['close'][-1] if data['close'] else "N/A"
                latest_chg = data['chg'][-1] if data['chg'] else "N/A"
                latest_pct = data['pct_chg'][-1] if data['pct_chg'] else "N/A"
            except (IndexError, TypeError) as e:
                self.A50_table.append(f"数据解析错误: {str(e)}")
                return
                
            # 更新图表
            try:
                self.A50_figure.clear()
                ax = self.A50_figure.add_subplot(111)
                
                if data['time'] and data['close']:
                    ax.plot(data['time'], data['close'], label=f'价格 (最新: {latest_close})')
                    ax.set_title(f'A50 实时价格走势 (北京时间 {latest_time})')
                    ax.set_ylabel('价格')
                    ax.legend()
                    ax.grid(True)
                
                # Auto-format date labels based on time range
                if len(data['time']) > 0:
                    time_range = len(data['time'])
                    if time_range > 20:  # Long time range - show fewer labels
                        ax.xaxis.set_major_locator(plt.MaxNLocator(6))
                    plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
                
                # Adjust layout with padding
                self.A50_figure.tight_layout(pad=2.0, h_pad=1.0)
                self.A50_canvas.draw()
            except Exception as e:
                self.A50_table.append(f"图表更新失败: {str(e)}")
                
            # 更新数据表格
            self.A50_table.clear()
            self.A50_table.append("=== A50 实时数据 ===")
            self.A50_table.append(f"更新时间(北京): {latest_time}")
            self.A50_table.append(f"最新价格: {latest_close}")
            self.A50_table.append(f"涨跌额: {latest_chg}")
            self.A50_table.append(f"涨跌幅: {latest_pct}")
            
            if data['time'] and data['close'] and data['chg'] and data['pct_chg']:
                self.A50_table.append("\n=== 历史数据 ===")
                # 显示最近5条数据
                for i in range(min(10, len(data['time']))):
                    idx = -1 - i  # 从最新到最旧
                    self.A50_table.append(
                        f"{data['time'][idx]} | 价格: {data['close'][idx]} | "
                        f"涨跌: {data['chg'][idx]} | 涨跌幅: {data['pct_chg'][idx]}"
                    )
                    
        except Exception as e:
            import traceback
            error_msg = f"更新显示时出错:\n{str(e)}\n{traceback.format_exc()}"
            print(error_msg)
            self.A50_table.append("处理数据时发生错误")


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
    print("Starting application...")  # Debug print
    app = QApplication(sys.argv)
    print("QApplication created")  # Debug print
    
    window = FinancialAnalysisApp()
    print("Main window created")  # Debug print
    
    window.show()
    print("Main window shown")  # Debug print
    
    ret = app.exec_()
    print(f"Application exited with code {ret}")  # Debug print
    sys.exit(ret)
