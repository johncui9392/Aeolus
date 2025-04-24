from WindPy import w
import datetime
import pandas as pd
import time
from PyQt5.QtCore import QObject, QThread, pyqtSignal

class GoldRealtime(QObject):
    data_updated = pyqtSignal(dict)  # Signal for thread-safe updates

    def __init__(self):
        super().__init__()
        self.running = False
        self.interval = 5  # 5秒刷新间隔
        self.instrument = "GC.CMX"  # 黄金现货代码
        self.fields = "close,chg,pct_chg"  # 需要获取的字段
        self._thread = QThread()
        self.moveToThread(self._thread)
        self._thread.started.connect(self._run)
        
    def start(self):
        """启动实时数据获取"""
        if not w.isconnected():
            w.start()
            
        if not self.running:
            self.running = True
            self._thread.start()
            self.update_data()  # Immediate first update

    def _run(self):
        """Main thread loop"""
        while self.running:
            self.update_data()
            QThread.msleep(self.interval * 1000)
        
    def stop(self):
        """停止实时数据获取"""
        self.running = False
        self._thread.quit()
        self._thread.wait()

    def register_callback(self, callback):
        """注册数据更新回调函数"""
        self.data_updated.connect(callback)
        
    def update_data(self):
        """获取并更新数据"""
        try:
            if not self.running:
                return
                    
            w.start()  # 直接启动WindPy连接

            import pytz
            # 获取当前时间
            now = datetime.datetime.now()
            # 定义纽约时区
            eastern = pytz.timezone('US/Eastern')
            # 本地化当前时间并判断是否为夏令时
            is_dst = eastern.localize(now, is_dst=None).dst() != datetime.timedelta(0)

            # 根据夏令时调整时差
            if is_dst:
                # 夏令时，纽约（UTC-4）和北京（UTC+8）时差为 12 小时
                time_diff = 12
            else:
                # 冬令时，纽约（UTC-5）和北京（UTC+8）时差为 13 小时
                time_diff = 13

            end_time = datetime.datetime.now() - datetime.timedelta(hours=time_diff)
            start_time = end_time - datetime.timedelta(hours=120)
            
            # Ensure WindPy is connected
            if not w.isconnected():
                w.start()
                time.sleep(1)  # Give it time to connect
                
            wsidata = w.wsi(self.instrument, self.fields, start_time, end_time)
            
            # Check if we got valid data
            if wsidata.ErrorCode != 0 or not wsidata.Data or len(wsidata.Data) < 3:
                data = {
                    'time': ["无数据"],
                    'close': [0],
                    'chg': [0],
                    'pct_chg': ["0.00%"]
                }
                self.data_updated.emit(data)
                return  # 保持定时器继续运行
                
            times = [t.strftime("%Y%m%d %H:%M:%S") for t in wsidata.Times] if wsidata.Times else ["无数据"]
            close_prices = wsidata.Data[0] if len(wsidata.Data) > 0 else [0]
            changes = wsidata.Data[1] if len(wsidata.Data) > 1 else [0]
            pct_changes = wsidata.Data[2] if len(wsidata.Data) > 2 else [0]
            
            data = {
                'time': times,
                'close': close_prices,
                'chg': changes,
                'pct_chg': [f"{x:.2f}%" for x in pct_changes]  # 格式化百分比
            }
            self.data_updated.emit(data)
            
        except Exception as e:
            # Emit empty data to prevent UI freeze
            self.data_updated.emit({'time': [], 'close': [], 'chg': [], 'pct_chg': []})

if __name__ == "__main__":
    # 测试用例
    def on_data_updated(data):
        print("收到黄金实时数据:")
        if data['time'] and data['time'][0] != "无数据":
            print(f"时间: {data['time'][-1]}")
            print(f"收盘价: {data['close'][-1]}")
            print(f"涨跌: {data['chg'][-1]}")
            print(f"涨跌幅: {data['pct_chg'][-1]}")
        else:
            print("无有效数据")
        print("-------------------")
    
    gold = GoldRealtime()
    gold.register_callback(on_data_updated)
    print("启动黄金实时数据获取...")
    gold.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n停止黄金实时数据获取")