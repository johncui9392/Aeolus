from WindPy import w
import datetime
import pandas as pd
import numpy as np
from scipy import stats

def monitor_index_valuation(windcode, start_date=None, end_date=None, years=10):
    """
    监控指数估值(10年分析)
    参数:
        windcode: 指数Wind代码
        start_date: 开始日期(默认5年前)
        end_date: 结束日期(默认今天)
        years: 分析年数(默认10年)
    返回:
        包含以下内容的字典:
        - PE/PB数据
        - 历史分位数
        - 移动平均线数据
        - 回归趋势线参数
        - 时间序列数据
    """
    try:
        w.start()
        if start_date is None:
            start_date = (datetime.datetime.now() - datetime.timedelta(days=365*years)).strftime('%Y-%m-%d')
        if end_date is None:
            end_date = datetime.datetime.now().strftime('%Y-%m-%d')

        fields = "pe_ttm,pb_lf"
        data = w.wsd(windcode, fields, start_date, end_date, "")
        if data.ErrorCode != 0:
            print(f"获取估值数据失败: {data.ErrorCode}")
            return None

        df = pd.DataFrame({
            'PE': data.Data[0],
            'PB': data.Data[1]
                            }, index=pd.to_datetime(data.Times))

        metrics = {}
        trend_params = {}
        
        for col in ['PE', 'PB']:
            # 计算分位数
            current_val = df[col].iloc[-1]
            hist_vals = df[col].dropna()
            if len(hist_vals) > 0:
                metrics[f'{col}_Quantile'] = stats.percentileofscore(hist_vals, current_val)/100
            metrics[col] = current_val
            
            # 计算移动平均
            df[f'{col}_60MA'] = df[col].rolling(60).mean()

            # 计算 PE 布林带（以 PE 为例，PB 同理）
            if col == 'PE':
                window = 60  # 布林带计算窗口
                std_dev = df[col].rolling(window).std()
                df[f'{col}_UpperBand'] = df[f'{col}_60MA'] + 2 * std_dev  # 上轨
                df[f'{col}_LowerBand'] = df[f'{col}_60MA'] - 2 * std_dev  # 下轨
            
            # 计算趋势线参数
            x = np.arange(len(df))
            mask = ~np.isnan(df[col])
            if sum(mask) > 1:
                slope, intercept = np.polyfit(x[mask], df[col][mask], 1)
                trend_params[col] = {'slope': slope, 'intercept': intercept}

        return {
            **metrics,
            'data': df,
            'trend_params': trend_params,
            'analysis_period': f"{start_date} 至 {end_date}"
        }

    except Exception as e:
        print(f"估值分析失败: {str(e)}")
        return None