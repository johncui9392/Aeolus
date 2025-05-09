from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton, QTableWidget, QHeaderView, QTableWidgetItem, QComboBox
from PyQt5.QtCore import QTimer, QThread, pyqtSignal
from matplotlib.figure import Figure
from matplotlib.backends.backend_qt5agg import FigureCanvas
from WindPy import w
import traceback
import matplotlib.pyplot as plt
import datetime
from financial_tools.realtime_data import get_realtime_data

def add_stock_realtime_tab(parent):
    """实时行情标签页"""
    try:
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 控制区域
        control_layout = QHBoxLayout()
        
        # 股票代码输入
        parent.stock_code_input = QLineEdit()
        parent.stock_code_input.setPlaceholderText("输入股票代码,如600941.SH")
        control_layout.addWidget(parent.stock_code_input)
        
        # 添加按钮
        parent.add_stock_btn = QPushButton("添加监控")
        parent.add_stock_btn.clicked.connect(lambda: add_stock_monitor(parent))
        control_layout.addWidget(parent.add_stock_btn)
        
        # 刷新按钮
        parent.refresh_btn = QPushButton("手动刷新")
        parent.refresh_btn.clicked.connect(lambda: refresh_stock_data(parent))
        control_layout.addWidget(parent.refresh_btn)

        # 新增：股票选择下拉列表
        parent.stock_selector = QComboBox()
        parent.stock_selector.currentTextChanged.connect(lambda code: change_stock_chart(parent, code))
        control_layout.addWidget(parent.stock_selector)
        
        layout.addLayout(control_layout)
        
        # 表格区域
        parent.stock_table = QTableWidget()
        parent.stock_table.setColumnCount(8)
        parent.stock_table.setHorizontalHeaderLabels(["代码", "最新价", "涨跌额", "涨跌幅", "最高价", "最低价", "日期", "时间"])
        parent.stock_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        layout.addWidget(parent.stock_table)

        # 图表区域
        parent.stock_figure = plt.figure()
        parent.stock_canvas = FigureCanvas(parent.stock_figure)
        layout.addWidget(parent.stock_canvas)
        
        tab.setLayout(layout)
        parent.stock_realtime_tab_index = parent.tabs.addTab(tab, "实时行情监控")
        
        # 初始化数据
        parent.monitored_stocks = {}
        parent.stock_history = {}  # 存储历史数据用于绘图
        if not w.isconnected():
            w.start()
            
        # 定时器更新时间
        parent.stock_timer = QTimer()
        parent.stock_timer.timeout.connect(lambda: update_stock_data(parent))
        parent.stock_timer.start(3000)  # 3秒刷新一次
        
    except Exception as e:
        QMessageBox.critical(parent, "初始化错误", f"无法初始化股票实时行情:\n{str(e)}")

def add_stock_monitor(parent):
    """添加行情监控"""
    code = parent.stock_code_input.text().strip()
    if code and code not in parent.monitored_stocks:
        parent.monitored_stocks[code] = {
            'rt_last': 0,
            'rt_chg': 0, 
            'rt_pct_chg': 0,
            'rt_high': 0,
            'rt_low': 0,
            'history': []  # 存储历史数据用于绘图
        }
        update_stock_table(parent)
        update_stock_data(parent, code)
        # 新增：将新添加的股票代码添加到下拉列表中
        parent.stock_selector.addItem(code)

def change_stock_chart(parent, code):
    """切换显示的股票图表"""
    if code:
        update_stock_chart(parent, code)

def update_stock_table(parent):
    """更新股票表格数据"""
    parent.stock_table.setRowCount(len(parent.monitored_stocks))
    for row, (code, data) in enumerate(parent.monitored_stocks.items()):
        parent.stock_table.setItem(row, 0, QTableWidgetItem(code))
        parent.stock_table.setItem(row, 1, QTableWidgetItem(f"{data['rt_last']:.2f}"))
        parent.stock_table.setItem(row, 2, QTableWidgetItem(f"{data['rt_chg']:.2f}"))
        parent.stock_table.setItem(row, 3, QTableWidgetItem(f"{data['rt_pct_chg']:.2f}%"))
        parent.stock_table.setItem(row, 4, QTableWidgetItem(f"{data['rt_high']:.2f}"))
        parent.stock_table.setItem(row, 5, QTableWidgetItem(f"{data['rt_low']:.2f}"))
        
        # Format date from float YYYYMMDD to YYYY-MM-DD
        if 'rt_date' in data:
            date_str = f"{int(data['rt_date']):08d}"
            formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            parent.stock_table.setItem(row, 6, QTableWidgetItem(formatted_date))
        else:
            parent.stock_table.setItem(row, 6, QTableWidgetItem("N/A"))
        
        # Format time from float HHMMSS to HH:MM:SS
        if 'rt_time' in data:
            time_str = f"{int(data['rt_time']):06d}"
            formatted_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
            parent.stock_table.setItem(row, 7, QTableWidgetItem(formatted_time))
        else:
            parent.stock_table.setItem(row, 7, QTableWidgetItem("N/A"))

def update_stock_data(parent, code=None):
    """更新股票数据"""
    if not w.isconnected():
        w.start()
        
    codes = [code] if code else list(parent.monitored_stocks.keys())
    
    for code in codes:
        try:
            df = get_realtime_data(code)
            if df is not None and not df.empty:
                # 更新实时数据 - 处理长格式DataFrame
                stock_data = df[df['StockCode'] == code]
                for _, row in stock_data.iterrows():
                    field = row['Field'].lower()  # Convert to lowercase to match dict keys
                    value = row['Value']
                    if field == 'rt_last':
                        parent.monitored_stocks[code]['rt_last'] = value
                    elif field == 'rt_chg':
                        parent.monitored_stocks[code]['rt_chg'] = value
                    elif field == 'rt_pct_chg':
                        parent.monitored_stocks[code]['rt_pct_chg'] = value
                    elif field == 'rt_high':
                        parent.monitored_stocks[code]['rt_high'] = value
                    elif field == 'rt_low':
                        parent.monitored_stocks[code]['rt_low'] = value
                    elif field == 'rt_date':
                        parent.monitored_stocks[code]['rt_date'] = value
                    elif field == 'rt_time':
                        parent.monitored_stocks[code]['rt_time'] = value
                
                # 记录历史数据
                # 修改为使用获取到的 rtdate 和 rttime
                rt_time_str = parent.monitored_stocks[code]['rt_time']
                rt_date_str = parent.monitored_stocks[code]['rt_date']  # 假设存在 rtdate 字段

                try:
                    if isinstance(rt_time_str, float):
                        rt_time_str = str(int(rt_time_str)).zfill(6)
                    else:
                        rt_time_str = str(rt_time_str).zfill(6)
                    time_obj = datetime.time(int(rt_time_str[:2]), int(rt_time_str[2:4]), int(rt_time_str[4:6]))

                    # 将 rt_date_str 转换为字符串
                    rt_date_str = str(int(rt_date_str)) if isinstance(rt_date_str, float) else rt_date_str
                    date_obj = datetime.datetime.strptime(rt_date_str, '%Y%m%d').date()
                    rt_time = datetime.datetime.combine(date_obj, time_obj)
                except ValueError:
                    print(f"无法解析时间 {rt_date_str} {rt_time_str}，使用当前时间替代")
                    rt_time = datetime.datetime.now()
                parent.monitored_stocks[code]['history'].append({
                    'time': rt_time,
                    'price': parent.monitored_stocks[code]['rt_last']
                })
                
                # 保留最近100条数据
                if len(parent.monitored_stocks[code]['history']) > 100:
                    parent.monitored_stocks[code]['history'] = parent.monitored_stocks[code]['history'][-100:]
                
                # 更新图表
                update_stock_chart(parent, code)
        except Exception as e:
            print(f"更新股票{code}数据失败: {str(e)}")
    
    update_stock_table(parent)

def refresh_stock_data(parent):
    """手动刷新股票数据"""
    update_stock_data(parent)

def update_stock_chart(parent, code):
    """更新股票图表"""
    if code not in parent.monitored_stocks or not parent.monitored_stocks[code]['history']:
        return
        
    history = parent.monitored_stocks[code]['history']
    times = [x['time'] for x in history]
    prices = [x['price'] for x in history]
    
    parent.stock_figure.clear()
    ax = parent.stock_figure.add_subplot(111)
    ax.plot(times, prices, label=f'{code} 价格走势')
    
    # 禁用 y 轴的科学计数法
    ax.ticklabel_format(axis='y', style='plain')
    
    ax.set_title(f'{code} 实时价格')
    ax.set_ylabel('价格')
    ax.legend()
    ax.grid(True)
    
    # 自动调整时间轴标签
    if len(times) > 20:
        ax.xaxis.set_major_locator(plt.MaxNLocator(6))
    plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
    
    parent.stock_figure.tight_layout()
    parent.stock_canvas.draw()

class VolumeWorker(QThread):
    data_ready = pyqtSignal(dict)
    
    def run(self):
        """在后台线程中获取成交数据"""
        try:
            data = get_combined_volume_data()
            self.data_ready.emit(data)
        except Exception as e:
            self.data_ready.emit({'error': str(e)})

