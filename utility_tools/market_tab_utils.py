from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, QPushButton, QMessageBox
from matplotlib.figure import Figure
from matplotlib.backends.backend_qt5agg import FigureCanvas
from WindPy import w
import traceback
import matplotlib.pyplot as plt
import datetime

def add_market_tab(tab_title, realtime_class, table_attr, figure_attr, canvas_attr, monitor_btn_attr, subscribed_attr, update_display_method, parent):
    """通用行情标签页方法"""
    try:
        # 检查 update_display_method 是否为可调用对象
        if not callable(update_display_method):
            raise ValueError(f"update_display_method 必须是可调用的函数，当前传入的类型是 {type(update_display_method)}")
        
        tab = QWidget()
        layout = QVBoxLayout()
        
        # 创建结果显示区域
        setattr(parent, table_attr, QTextEdit())
        getattr(parent, table_attr).setReadOnly(True)
        layout.addWidget(getattr(parent, table_attr))
        
        # 控制区域
        control_layout = QHBoxLayout()
        setattr(parent, monitor_btn_attr, QPushButton("停止监控"))
        getattr(parent, monitor_btn_attr).clicked.connect(lambda: toggle_monitoring(subscribed_attr, monitor_btn_attr, realtime_class, table_attr,tab_title, parent))
        control_layout.addWidget(getattr(parent, monitor_btn_attr))
        
        reset_btn = QPushButton("重置")
        reset_btn.clicked.connect(lambda: reset_market_tab(figure_attr, canvas_attr, table_attr, subscribed_attr, monitor_btn_attr,tab_title, parent))
        control_layout.addWidget(reset_btn)
        layout.addLayout(control_layout)
        
        # 图表区域
        setattr(parent, figure_attr, plt.figure())
        setattr(parent, canvas_attr, FigureCanvas(getattr(parent, figure_attr)))
        layout.addWidget(getattr(parent, canvas_attr))
        tab.setLayout(layout)
        tab_index = parent.tabs.addTab(tab, tab_title)
        
        # 初始化实时数据对象
        getattr(parent, table_attr).append(f"{tab_title} 接口准备就绪")
        if not w.isconnected():
            w.start()
            
        setattr(parent, f"{subscribed_attr}_realtime", realtime_class())
        getattr(parent, f"{subscribed_attr}_realtime").register_callback(lambda data: update_display_method(data, table_attr, figure_attr, canvas_attr, tab_title, parent))
        
        # 自动开启监控
        start_market_updates(subscribed_attr, realtime_class, table_attr,tab_title, parent)            
        return tab_index
        
    except Exception as e:
        error_msg = f"初始化{tab_title}标签页时出错:\n{str(e)}\n{traceback.format_exc()}"
        print(error_msg)  # 控制台输出
        QMessageBox.critical(parent, "初始化错误", f"无法初始化{tab_title}:\n{str(e)}")

def toggle_monitoring(subscribed_attr, monitor_btn_attr, realtime_class, table_attr,tab_title, parent):
    """通用切换监控状态方法"""
    if not hasattr(parent, subscribed_attr):
        setattr(parent, subscribed_attr, False)
        
    if not getattr(parent, subscribed_attr):
        start_market_updates(subscribed_attr, realtime_class, table_attr,tab_title, parent)
        getattr(parent, monitor_btn_attr).setText("停止监控")
    else:
        stop_market_updates(subscribed_attr, realtime_class, table_attr,tab_title, parent)
        getattr(parent, monitor_btn_attr).setText("开启监控")  

def start_market_updates(subscribed_attr, realtime_class, table_attr,tab_title, parent):
    """通用启动行情更新方法"""
    try:
        if not w.isconnected():
            w.start()
            if not w.isconnected():
                raise ConnectionError("WindPy连接失败")
        
        setattr(parent, subscribed_attr, True)
        getattr(parent, f"{subscribed_attr}_realtime").start()
        getattr(parent, table_attr).append(f"{tab_title} 行情监控已启动...")
        
    except Exception as e:
        getattr(parent, table_attr).append(f"启动失败: {str(e)}")
        setattr(parent, subscribed_attr, False)
        QMessageBox.critical(parent, "错误", f"启动 {tab_title} 行情失败:\n{str(e)}")
        
def stop_market_updates(subscribed_attr, realtime_class, table_attr,tab_title, parent):
    """通用停止行情更新方法"""
    if hasattr(parent, subscribed_attr) and getattr(parent, subscribed_attr):
        getattr(parent, f"{subscribed_attr}_realtime").stop()
        setattr(parent, subscribed_attr, False)
        getattr(parent, table_attr).append(f"{tab_title} 行情监控已停止")

def update_market_display(data, table_attr, figure_attr, canvas_attr, tab_title, parent):
    """通用更新行情显示方法"""
    try:
        if not data or not isinstance(data, dict):
            getattr(parent, table_attr).append("无效数据格式")
            return
            
        # 验证数据字段
        required_fields = ['time', 'close', 'chg', 'pct_chg']
        if not all(field in data for field in required_fields):
            getattr(parent, table_attr).append("数据字段不完整")
            return
            
        if not data['time']:
            getattr(parent, table_attr).append("无有效时间数据")
            return
            
        # 获取最新数据点
        try:
            latest_time = data['time'][-1] if data['time'] else "N/A"
            latest_close = data['close'][-1] if data['close'] else "N/A"
            latest_chg = data['chg'][-1] if data['chg'] else "N/A"
            latest_pct = data['pct_chg'][-1] if data['pct_chg'] else "N/A"
        except (IndexError, TypeError) as e:
            getattr(parent, table_attr).append(f"数据解析错误: {str(e)}")
            return
            
        # 更新图表
        try:
            getattr(parent, figure_attr).clear()
            ax = getattr(parent, figure_attr).add_subplot(111)
            
            if data['time'] and data['close']:
                ax.plot(data['time'], data['close'], label=f'价格 (最新: {latest_close})')
                ax.set_title(f'{tab_title} 价格走势 (交易所当地时间 {latest_time})')
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
            getattr(parent, figure_attr).tight_layout(pad=2.0, h_pad=1.0)
            getattr(parent, canvas_attr).draw()
        except Exception as e:
            getattr(parent, table_attr).append(f"图表更新失败: {str(e)}")
            
        # 更新数据表格
        getattr(parent, table_attr).clear()
        getattr(parent, table_attr).append(f"=== {tab_title} 实时数据 ===")
        getattr(parent, table_attr).append(f"更新时间(交易所时间): {latest_time}")
        getattr(parent, table_attr).append(f"最新价格: {latest_close}")
        getattr(parent, table_attr).append(f"涨跌额: {latest_chg}")
        getattr(parent, table_attr).append(f"涨跌幅: {latest_pct}")
        
        if data['time'] and data['close'] and data['chg'] and data['pct_chg']:
            getattr(parent, table_attr).append("\n=== 历史数据 ===")
            # 显示最近5条数据
            for i in range(min(10, len(data['time']))):
                idx = -1 - i  # 从最新到最旧
                getattr(parent, table_attr).append(
                    f"{data['time'][idx]} | 价格: {data['close'][idx]} | "
                    f"涨跌: {data['chg'][idx]} | 涨跌幅: {data['pct_chg'][idx]}"
                )
                
    except Exception as e:
        error_msg = f"更新显示时出错:\n{str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        getattr(parent, table_attr).append("处理数据时发生错误")

def reset_market_tab(figure_attr, canvas_attr, table_attr, subscribed_attr, monitor_btn_attr,tab_title, parent):
    """通用重置行情标签页方法"""
    getattr(parent, figure_attr).clear()
    getattr(parent, canvas_attr).draw()
    getattr(parent, table_attr).clear()
    if hasattr(parent, subscribed_attr) and getattr(parent, subscribed_attr):
        stop_market_updates(subscribed_attr, None, table_attr,tab_title, parent)
        # 更新按钮文本为“开启监控”
        if hasattr(parent, monitor_btn_attr):
            getattr(parent, monitor_btn_attr).setText("开启监控")