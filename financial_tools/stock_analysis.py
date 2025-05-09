from WindPy import w
import datetime
import pandas as pd
import numpy as np
from scipy import stats

def getstocklist(windcode):
    """获取指数成分股列表(适配WindPy接口)返回{代码:简称}字典"""
    try:
        import datetime
        current_date = datetime.datetime.now().strftime('%Y%m%d')
        data = w.wset("indexconstituent", f"windcode={windcode};date={current_date}")
        if data.ErrorCode == 0 and hasattr(data, 'Data') and len(data.Data) > 2:
            return dict(zip(data.Data[1], data.Data[2]))
            
        print(f"获取成分股失败: {data.ErrorCode}")
        return {}
    except Exception as e:
        print(f"获取成分股异常: {str(e)}")
        return {}

def return_60dayhighlow(stockcodelist):
    """计算股票60日最高价和最低价(适配WindPy接口)"""
    w.start()
    summit60daydict = {}
    trough60daydict = {}
    
    end_date = datetime.datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=120)).strftime('%Y-%m-%d')
    
    high_data = w.wsd(",".join(stockcodelist), "high", start_date, end_date, "")
    if high_data.ErrorCode != 0:
        print(f"获取high数据失败: {high_data.ErrorCode}")
        return {}, {}
    
    low_data = w.wsd(",".join(stockcodelist), "low", start_date, end_date, "")
    if low_data.ErrorCode != 0:
        print(f"获取low数据失败: {low_data.ErrorCode}")
        return {}, {}
    
    for i, stockcode in enumerate(stockcodelist):
        high_prices = [float(x) for x in high_data.Data[i] if x is not None]
        low_prices = [float(x) for x in low_data.Data[i] if x is not None]
        
        if len(high_prices) >= 60:
            summit60daydict[stockcode] = max(high_prices[-60:])
            trough60daydict[stockcode] = min(low_prices[-60:])
    
    return summit60daydict, trough60daydict

def test_last_day_stock_price(stockcodelist, summit60daydict, trough60daydict, date=None):
    """检测股票最新收盘价是否创60日新高或新低，返回带简称的结果"""
    w.start()
    highresult_list = []
    lowresult_list = []
    
    end_date = datetime.datetime.now().strftime('%Y-%m-%d') if date is None else date
    
    # 获取股票简称
    stock_str = ",".join(stockcodelist)
    name_data = w.wss(stock_str, "sec_name", f"tradeDate={end_date.replace('-','')}")
    code_to_name = dict(zip(stockcodelist, name_data.Data[0])) if name_data.ErrorCode == 0 else {}
    
    # 获取高低价数据
    price_data = w.wss(stock_str, "high,low", f"tradeDate={end_date.replace('-','')}")
    
    if price_data.ErrorCode != 0 or len(price_data.Data[0]) != len(stockcodelist):
        print(f"获取数据失败: {price_data.ErrorCode if price_data.ErrorCode !=0 else '数据不完整'}")
        return [], []
    
    for i, stockcode in enumerate(stockcodelist, 1):
        latest_high = float(price_data.Data[0][i-1]) if price_data.Data[0][i-1] is not None else None
        latest_low = float(price_data.Data[1][i-1]) if price_data.Data[1][i-1] is not None else None
        
        if latest_high is None or latest_low is None:
            continue
            
        if stockcode in summit60daydict and latest_high >= summit60daydict[stockcode]:
            name = code_to_name.get(stockcode, stockcode)
            highresult_list.append(f"{stockcode}({name})")
        elif stockcode in trough60daydict and latest_low <= trough60daydict[stockcode]:
            name = code_to_name.get(stockcode, stockcode)
            lowresult_list.append(f"{stockcode}({name})")
    
    return highresult_list, lowresult_list

def highlowautoeye(stocklistcode, highresult_list, lowresult_list, email_config=None):
    """根据股票列表查询股票名称，并统计数量"""
    w.start()
    
    if not (isinstance(stocklistcode, str) and 
            len(stocklistcode) >= 6 and 
            stocklistcode[-3:] in ('.SH', '.SZ')):
        print(f"警告: 无效的Wind代码格式: {stocklistcode}")
        wind_code = stocklistcode
    else:
        wind_code = stocklistcode
    
    data = w.wset("sectorconstituent", f"windcode={wind_code};")
    
    if data.ErrorCode != 0 or not hasattr(data, 'Data') or len(data.Data) < 3:
        code_to_name = {code: code for code in highresult_list + lowresult_list}
    else:
        code_to_name = {}
        for i in range(len(data.Data[0])):
            try:
                code = data.Data[1][i]
                name = data.Data[2][i] if len(data.Data) > 2 else code
                code_to_name[code] = name
            except IndexError:
                continue
    
    now = datetime.datetime.now()
    update_time = datetime.datetime.strptime(str(now.date()) + '17:30', '%Y-%m-%d%H:%M')
    report_date = now.strftime('%Y-%m-%d') if update_time <= now else \
                 (now - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    
    if email_config:
        report_content = f"""
        {wind_code}指数60日趋势分析报告
        ------------------------
        报告日期: {report_date}
        新高股票数量: {len(highresult_list)}
        新低股票数量: {len(lowresult_list)}
        
        新高股票列表:
        {', '.join([f"{code}({code_to_name.get(code, '')})" for code in highresult_list])}
        
        新低股票列表: 
        {', '.join([f"{code}({code_to_name.get(code, '')})" for code in lowresult_list])}
        """
        

    
    return {
        'report_date': report_date,
        'high_stocks': highresult_list,
        'low_stocks': lowresult_list,
        'code_to_name': code_to_name
    }

if __name__ == "__main__":
    print("测试股票分析功能...")
    w.start()
    
    # 测试获取指数成分股
    print("\n测试获取沪深300成分股:")
    hs300_stocks = getstocklist("000300.SH")
    print(hs300_stocks)
    print(f"获取到{len(hs300_stocks)}只成分股")
    if hs300_stocks:
        print("示例:", list(hs300_stocks.items())[:3])
    
    # 测试计算60日高低点
    if hs300_stocks:
        print("\n测试计算60日高低点:")
        stock_codes = list(hs300_stocks.keys())[:10]  # 测试前10只股票
        highs, lows = return_60dayhighlow(stock_codes)
        print(f"获取到{len(highs)}只股票的高点, {len(lows)}只股票的低点")
        if highs and lows:
            sample_code = list(highs.keys())[0]
            print(f"示例股票{sample_code}: 60日最高价={highs[sample_code]}, 60日最低价={lows[sample_code]}")
