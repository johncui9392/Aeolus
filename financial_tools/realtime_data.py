from WindPy import w
import pandas as pd

def get_realtime_data(stock_code, fields="rt_last,rt_chg,rt_pct_chg,rt_high,rt_low,rt_date,rt_time"):
    """
    获取实时行情数据并返回DataFrame
    
    参数:
        stock_code: 股票代码，可以是单个代码或多个代码(逗号分隔)
        fields: 行情字段，默认"rt_last,rt_chg,rt_pct_chg,rt_high,rt_low,rt_date,rt_time"
    
    返回:
        pandas.DataFrame: 包含实时行情数据的DataFrame，带有StockCode列
    """
    if not w.isconnected():
        w.start()
    
    codes = stock_code.split(',')
    data = w.wsq(stock_code, fields)
    
    if data.ErrorCode != 0:
        return pd.DataFrame({"Error": [f"Wind Error: {data.ErrorCode}"]})
    
    dfs = []
    for i, code in enumerate(codes):
        df = pd.DataFrame({
            "StockCode": code,
            "Field": data.Fields,
            "Value": [x[i] if isinstance(x, list) else x for x in data.Data]
        })
        dfs.append(df)
    
    return pd.concat(dfs, ignore_index=True)

if __name__ == "__main__":
    # 测试用例
    df = get_realtime_data("600941.SH,600519.SH")
    print("实时行情数据:")
    print(df.to_string())
