from WindPy import w
import datetime
import pandas as pd
import numpy as np
from scipy import stats

def index_signal_wind():
    """指数二八轮动信号(Wind版) """
    try:
        w.start()
        
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.datetime.now() - datetime.timedelta(days=3*365)).strftime("%Y-%m-%d")
        
        hs300 = w.wsd("000300.SH", "close", start_date, today, "Fill=Previous")
        zz500 = w.wsd("000905.SH", "close", start_date, today, "Fill=Previous") 
        zz1000 = w.wsd("000852.SH", "close", start_date, today, "Fill=Previous")
        
        df_all = pd.DataFrame({
            'hs300': [float(x) if x is not None else float('nan') for x in hs300.Data[0]],
            'zz500': [float(x) if x is not None else float('nan') for x in zz500.Data[0]],
            'zz1000': [float(x) if x is not None else float('nan') for x in zz1000.Data[0]]
        }, index=pd.to_datetime(hs300.Times))
        
        df_all.ffill(inplace=True)
        
        df_all['hs300_25d'] = df_all['hs300'].shift(25)
        df_all['zz500_25d'] = df_all['zz500'].shift(25)
        df_all['zz1000_25d'] = df_all['zz1000'].shift(25)
        
        df_all['hs300_inc'] = (df_all['hs300'] - df_all['hs300_25d']) / df_all['hs300_25d']
        df_all['zz500_inc'] = (df_all['zz500'] - df_all['zz500_25d']) / df_all['zz500_25d']
        df_all['zz1000_inc'] = (df_all['zz1000'] - df_all['zz1000_25d']) / df_all['zz1000_25d']
        
        last_row = df_all.iloc[-1]
        if (last_row['hs300_inc'] <= 0 and last_row['zz500_inc'] <= 0 and last_row['zz1000_inc'] <= 0):
            signal = '卖出所有证券'
        elif (last_row['hs300_inc'] - last_row['zz1000_inc'] > 0.005):
            signal = '买入ETF300'
        elif (last_row['zz1000_inc'] - last_row['hs300_inc'] > 0.005):
            signal = '买入ETF1000'
        else:
            signal = '持有'
        
        return {
            "signal": signal,
            "dates": df_all.index,
            "hs300_prices": df_all['hs300'],
            "zz500_prices": df_all['zz500'], 
            "zz1000_prices": df_all['zz1000'],
            "hs300_growth": df_all['hs300_inc']*100,
            "zz500_growth": df_all['zz500_inc']*100,
            "zz1000_growth": df_all['zz1000_inc']*100
        }
        
    except Exception as e:
        print(f"生成图表失败: {str(e)}")
        return None

