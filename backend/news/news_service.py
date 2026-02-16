import pandas as pd
import yfinance as yf


def fetch_news(ticker: str, count: int = 10) -> dict:
    """
    Fetch news articles for a given stock ticker.
    
    Args:
        ticker (str): The stock ticker symbol (e.g., 'AAPL', 'MSFT')
        count (int): Number of news items to retrieve (default: 10)
    
    Returns:
        dict: A dictionary containing news data with keys:
              - 'Title': List of news titles
              - 'summary': List of news summaries
              - 'link': List of clickthrough URLs
              - 'Date': List of publication dates
    """
    main_dictionary = {"Title": [], "summary": [], "link": [], "Date": []}
    
    try:
        ticker_data = yf.Ticker(ticker)
        news_list = ticker_data.get_news(count=count, tab='news')
        
        for i in range(count):
            try:
                if i:  # Skip the first item if needed
                    news_item = news_list[i]["content"]
                    
                    # Extract title
                    if "title" in news_item:
                        main_dictionary["Title"].append(news_item["title"])
                    
                    # Extract publication date
                    if "displayTime" in news_item and news_item["displayTime"]:
                        main_dictionary["Date"].append(news_item["displayTime"])
                    else:
                        main_dictionary["Date"].append(" ")
                    
                    # Extract summary
                    if "summary" in news_item and news_item["summary"]:
                        main_dictionary["summary"].append(news_item["summary"])
                    else:
                        main_dictionary["summary"].append(" ")
                    
                    # Extract clickthrough URL
                    if (news_item.get("clickThroughUrl") is not None and 
                        "url" in news_item["clickThroughUrl"]):
                        main_dictionary["link"].append(news_item["clickThroughUrl"]["url"])
                    else:
                        main_dictionary["link"].append(" ")
            
            except (KeyError, TypeError, IndexError):
                # Skip items with missing or malformed data
                continue
        
        return main_dictionary
    
    except Exception as e:
        print(f"Sorry! We couldn't find a stock with that ticker '{ticker}'! Error: {str(e)}")
        return main_dictionary


def fetch_and_save_news(ticker: str, count: int = 10, output_file: str = 'output.json') -> pd.DataFrame:
    """
    Fetch news articles for a given ticker and save to JSON file.
    
    Args:
        ticker (str): The stock ticker symbol
        count (int): Number of news items to retrieve (default: 10)
        output_file (str): Path to the output JSON file (default: 'output.json')
    
    Returns:
        pd.DataFrame: DataFrame containing the news data
    """
    news_data = fetch_news(ticker, count)
    df = pd.DataFrame(news_data)
    df.to_json(output_file)
    return df


def print_news(ticker: str, count: int = 10) -> None:
    """
    Fetch and print news articles for a given ticker.
    
    Args:
        ticker (str): The stock ticker symbol
        count (int): Number of news items to retrieve (default: 10)
    """
    news_data = fetch_news(ticker, count)
    
    for i, title in enumerate(news_data["Title"]):
        print(f"{i}.")
        print(f"Title: {title}")
        if news_data["Date"][i] != " ":
            print(f"Published: {news_data['Date'][i]}")
        if news_data["summary"][i] != " ":
            print(f"Summary: {news_data['summary'][i]}")
        if news_data["link"][i] != " ":
            print(f"Click the link to view more: {news_data['link'][i]}")
        print()
