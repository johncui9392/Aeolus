from WindPy import w
import datetime
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
import smtplib
from email.mime.text import MIMEText

def get_combined_volume_data():
    """获取沪深两市分钟级成交额数据并计算总和和成交额累计"""
    if not w.isconnected():
        w.start()
    
    now = datetime.datetime.now()
    # 使用 w.tdaysoffset 获取上一交易日
    today_date = w.tdaysoffset(0, now.strftime('%Y-%m-%d')).Data[0][0].strftime('%Y-%m-%d')
    today_start = f"{today_date} 09:00:00"
    today_end = f"{today_date} 16:00:00"
    
    sh_today = w.wsi("000001.SH", "amt", today_start, today_end, "")
    sz_today = w.wsi("399001.SZ", "amt", today_start, today_end, "")
    
    # 使用 w.tdaysoffset 获取上一交易日
    yesterday_date = w.tdaysoffset(-1, now.strftime('%Y-%m-%d')).Data[0][0].strftime('%Y-%m-%d')
    yesterday_start = f"{yesterday_date} 09:00:00" 
    yesterday_end = f"{yesterday_date} 16:00:00"
    
    sh_yesterday = w.wsi("000001.SH", "amt", yesterday_start, yesterday_end, "")
    sz_yesterday = w.wsi("399001.SZ", "amt", yesterday_start, yesterday_end, "")
    
    def process_sh_volume(sh_data, sz_data):
        if sh_data.ErrorCode != 0 or sz_data.ErrorCode != 0:
            raise ValueError(f"WSI errors: SH={sh_data.ErrorCode}, SZ={sz_data.ErrorCode}")
        
        times = [t.strftime('%H:%M') for t in sh_data.Times]
        sh_amounts = [float(x) if x else 0 for x in sh_data.Data[0]]
        sz_amounts = [float(x) if x else 0 for x in sz_data.Data[0]]
        combined_amounts = [round(sh + sz, 2) for sh, sz in zip(sh_amounts, sz_amounts)]
        long_total = sum(amt for amt in combined_amounts if amt > 0)
        
        return times, combined_amounts, long_total
    
    today_times, today_total, long_total = process_sh_volume(sh_today, sz_today)
    yesterday_times, yesterday_total, _ = process_sh_volume(sh_yesterday, sz_yesterday)
    
    diff = []
    min_len = min(len(today_total), len(yesterday_total))
    for i in range(min_len):
        diff.append(round(today_total[i] - yesterday_total[i], 2))
    
    # Calculate cumulative sums
    today_cumulative = []
    cum_sum = 0
    for amt in today_total[:min_len]:
        cum_sum += amt
        today_cumulative.append(round(cum_sum, 2))
        
    yesterday_cumulative = []
    cum_sum = 0
    for amt in yesterday_total[:min_len]:
        cum_sum += amt
        yesterday_cumulative.append(round(cum_sum, 2))

    def plot_volume_difference(times, diff):
        """Plot the difference in combined volume between today and yesterday"""
        plt.figure(figsize=(12, 6))
        plt.plot(times, diff, label='Volume Difference (Today - Yesterday)', color='purple')
        plt.axhline(0, color='gray', linestyle='--')
        plt.title('Shanghai/Shenzhen Combined Volume Difference')
        plt.xlabel('Time')
        plt.ylabel('Volume Difference (亿)')
        plt.xticks(rotation=45)
        plt.legend()
        plt.grid(True)
        plt.tight_layout()
        plt.show()

    return {
        'times': today_times[:min_len],
        'today': today_total[:min_len],
        'yesterday': yesterday_total[:min_len],
        'today_cumulative': today_cumulative,
        'yesterday_cumulative': yesterday_cumulative,
        'diff': diff,
        'long_total': long_total,
        'plot_diff': lambda: plot_volume_difference(today_times[:min_len], diff)
    }

if __name__ == "__main__":
    print("测试成交额实时分析功能...")
    w.start()
    
    try:
        data = get_combined_volume_data()
        print(f"\n今日总成交额: {data['long_total']/10000:.2f}亿")
        print(f"最后时间点数据: {data['times'][-1]}")
        print(f"今日成交额: {data['today'][-1]:.2f}万")
        print(f"昨日成交额: {data['yesterday'][-1]:.2f}万")
        print(f"差异: {data['diff'][-1]:.2f}万")
        
        # 绘制差异图
        print("\n绘制成交额差异图...")
        data['plot_diff']()
        
    except Exception as e:
        print(f"测试失败: {str(e)}")
