from WindPy import w
import datetime
import pandas as pd
import numpy as np
from scipy import stats

def get_volatility_analysis(windcode, start_date=None, end_date=None, years=10, window=20):
    """
    监控指数波动率分析(10年分析)
    参数:
        windcode: 指数Wind代码
        start_date: 开始日期(默认years年前)
        end_date: 结束日期(默认今天)
        years: 分析年数(默认10年)
        window: 波动率计算窗口天数(默认20天)
    返回:
        包含以下内容的字典:
        - volatility_data: 波动率时间序列数据
        - current_hv: 当前波动率值
        - long_term_hv: 长期平均波动率
        - hv_change: 波动率变化值
        - hv_percentile: 当前波动率百分位
        - volatility_60MA: 60日移动平均波动率
        - trend_params: 趋势线参数
        - analysis_period: 分析时间段
    """
    try:
        w.start()
        if start_date is None:
            start_date = (datetime.datetime.now() - datetime.timedelta(days=365*years)).strftime('%Y-%m-%d')
        if end_date is None:
            end_date = datetime.datetime.now().strftime('%Y-%m-%d')

        data = w.wsd(windcode, "close", start_date, end_date, "")
        if data.ErrorCode != 0:
            print(f"获取数据失败: {data.ErrorCode}")
            return None
            
        df = pd.DataFrame({
            'close': [float(x) if x is not None else float('nan') for x in data.Data[0]]
        }, index=pd.to_datetime(data.Times))
        
        df.ffill(inplace=True)
        
        if len(df) < window:
            print(f"数据不足: 只有{len(df)}天数据, 需要至少{window}天")
            return None
        
        # 计算收益率和波动率
        df['return'] = df['close'].pct_change()
        df['volatility'] = df['return'].rolling(window=window).std() * np.sqrt(252) * 100

        # 计算移动平均
        df['volatility_60MA'] = df['volatility'].rolling(60).mean()

        # 计算趋势线参数
        trend_params = {}
        x = np.arange(len(df))
        mask = ~np.isnan(df['volatility'])
        if sum(mask) > 1:
            slope, intercept = np.polyfit(x[mask], df['volatility'][mask], 1)
            trend_params['volatility'] = {'slope': slope, 'intercept': intercept}

        # 计算指标
        current_hv = df['volatility'].iloc[-1] if len(df) > 0 else 0
        long_term_hv = df['volatility'].mean() if len(df) > 0 else 0
        hv_change = current_hv - df['volatility'].iloc[-window-1] if len(df) > window else 0
        hv_percentile = stats.percentileofscore(df['volatility'].dropna(), current_hv) if len(df) > 0 else 0

        return {
            'volatility_data': df['volatility'],
            'dates': df.index,
            'current_hv': current_hv,
            'long_term_hv': long_term_hv,
            'hv_change': hv_change,
            'hv_percentile': hv_percentile,
            'volatility_60MA': df['volatility_60MA'],
            'trend_params': trend_params,
            'analysis_period': f"{start_date} 至 {end_date}"
        }
        
    except Exception as e:
        print(f"波动率分析失败: {str(e)}")
        return None

if __name__ == "__main__":
    print("测试波动率分析功能...")
    w.start()
    
    # 测试沪深300指数波动率分析
    print("\n分析沪深300指数波动率(10年历史):")
    result = get_volatility_analysis("000300.SH")
    
    if result:
        print(f"\n当前波动率: {result['current_hv']:.2f}%")
        print(f"长期平均波动率: {result['long_term_hv']:.2f}%")
        print(f"波动率变化: {result['hv_change']:.2f}%")
        print(f"波动率百分位: {result['hv_percentile']:.1f}%")
        print(f"分析期间: {result['analysis_period']}")
        
        # 显示最近5个交易日波动率数据
        print("\n最近5个交易日波动率数据:")
        print(result['volatility_data'].tail())
    else:
        print("波动率分析失败")
