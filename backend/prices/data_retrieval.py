import yfinance as yf
import pandas as pd
from pandas.tseries.offsets import DateOffset
import pickle

currency_mapping = {
    '': 'USD',     # Default to USD for NASDAQ and similar
    '.L': 'GBP',
    '.DE': 'EUR',
    '.PA': 'EUR',
    '.TO': 'CAD',   # Toronto Stock Exchange
    '.F': 'EUR'
}

def calculate_position_values_with_currency_adjustment(transactions_dict, current_tickers, downloaded_data, fx_rates):
    position_values = {}
    total_portfolio_value = 0

    latest_date = max(fx_rates.keys())
    eur_rates = fx_rates[latest_date]

    for name, ticker in current_tickers.items():
        transactions = transactions_dict.get(ticker, [])

        if not transactions:
            continue

        try:
            data = downloaded_data[ticker]
            suffix = ticker.split('.')[-1] if '.' in ticker else ''
            currency = currency_mapping.get('.' + suffix, 'USD')

            total_shares = sum(transaction['shares'] for transaction in transactions if not transaction.get('sold', False))

            if total_shares <= 0:
                continue

            current_value_in_stock_currency = total_shares * data['Close'].iloc[-1]

            if currency != 'GBP':
                to_eur_rate = 1 / eur_rates.get(currency, 1)
                current_value_in_eur = current_value_in_stock_currency * to_eur_rate
                current_value_in_gbp = current_value_in_eur * eur_rates.get('GBP', 1)
            else:
                current_value_in_gbp = current_value_in_stock_currency

            position_values[name] = current_value_in_gbp
            total_portfolio_value += current_value_in_gbp

        except Exception as e:
            position_values[name] = f"Error: {e}"

    position_values['Total Portfolio'] = total_portfolio_value

    df = pd.DataFrame(list(position_values.items()), columns=['Company Name', 'Position Value (GBP)'])

    return df


def weekly_performance(transactions_dict, data_dict, name_to_ticker_map):
    weekly_performance_dict = {}
    end_value = 0.0
    start_value = 0.0

    for name, ticker in name_to_ticker_map.items():
        transactions = transactions_dict.get(ticker, [])
        if not transactions:
            continue

        data = data_dict.get(ticker)
        if data is None:
            continue

        total_shares = sum(transaction['shares'] for transaction in transactions if not transaction.get('sold', False))
        if total_shares == 0:
            continue

        recent_price = data['Close'].iloc[-1]
        one_week_ago_index = -6 if len(data) >= 6 else -len(data)
        one_week_ago_price = data['Close'].iloc[one_week_ago_index]

        start_value += total_shares * one_week_ago_price
        end_value += total_shares * recent_price

        stock_weekly_performance = ((recent_price - one_week_ago_price) / one_week_ago_price) * 100
        weekly_performance_dict[name] = round(stock_weekly_performance, 2)

    portfolio_weekly_performance = ((end_value - start_value) / start_value) * 100
    weekly_performance_dict['Total Portfolio'] = round(portfolio_weekly_performance, 2)

    df = pd.DataFrame(weekly_performance_dict.items(), columns=['Company Name', 'Weekly Performance (%)'])
    return df


def calculate_overall_performance(transactions_dict, data_dict, name_to_ticker_map, current_portfolio_value, cutoff_date=None):
    performance_dict = {}

    if cutoff_date is not None:
        cutoff_date = pd.to_datetime(cutoff_date)

    for name, ticker in name_to_ticker_map.items():
        transactions = transactions_dict.get(ticker, [])
        if not transactions:
            continue
        first_transaction_date = pd.to_datetime(transactions[0]['date'])

        data = data_dict.get(ticker)
        if data is None or first_transaction_date not in data.index:
            continue

        purchase_price = data.loc[first_transaction_date, 'Close']
        recent_price = data.loc[cutoff_date, 'Close'] if cutoff_date is not None else data['Close'].iloc[-1]

        percentage_change = ((recent_price - purchase_price) / purchase_price) * 100
        performance_dict[name] = round(percentage_change, 2)

    starting_fund_value = 10000
    fund_percentage_change = ((current_portfolio_value - starting_fund_value) / starting_fund_value) * 100
    performance_dict["Total Portfolio"] = round(fund_percentage_change, 2)

    df = pd.DataFrame(performance_dict.items(), columns=['Company Name', 'Performance (%)'])
    return df


def calculate_total_dividends(transactions_dict, historical_data, fx_rates):
    total_dividends_gbp = {}
    sum_of_all_dividends = 0

    for ticker, transactions in transactions_dict.items():
        if not transactions or ticker not in historical_data:
            continue

        current_shares = 0
        stock_dividends_gbp = 0
        position_sold = False

        suffix = ticker.split('.')[-1] if '.' in ticker else ''
        currency = currency_mapping.get('.' + suffix, 'USD')

        sorted_transactions = sorted(transactions, key=lambda x: x['date'])

        for date, row in historical_data[ticker].iterrows():
            while sorted_transactions and sorted_transactions[0]['date'] <= date.strftime('%Y-%m-%d'):
                transaction = sorted_transactions.pop(0)
                current_shares += transaction['shares']
                if 'sold' in transaction and transaction['sold']:
                    position_sold = True

            if position_sold:
                break

            if current_shares > 0 and 'Dividends' in row and row['Dividends'] > 0:
                dividend_amount = row['Dividends'] * current_shares
                stock_dividends_gbp += convert_dividend_to_gbp(dividend_amount, currency, date, fx_rates)

        total_dividends_gbp[ticker] = stock_dividends_gbp
        sum_of_all_dividends += stock_dividends_gbp

    return total_dividends_gbp, sum_of_all_dividends


def convert_dividend_to_gbp(amount, currency, date, fx_rates):
    """
    Convert an amount from a given currency to GBP using EUR as a pivot.
    :param amount: Amount in the original currency.
    :param currency: Original currency of the amount.
    :param date: Date of the conversion for fetching the appropriate exchange rate.
    :param fx_rates: Dictionary of exchange rates with EUR as the base.
    :return: Converted amount in GBP.
    """
    if currency == 'GBP':
        return amount

    formatted_date = date.strftime("%Y-%m-%d")
    to_eur_rate = fx_rates.get(formatted_date, {}).get(currency, 1)
    amount_in_eur = amount / to_eur_rate
    eur_to_gbp_rate = fx_rates.get(formatted_date, {}).get('GBP', 1)
    return amount_in_eur * eur_to_gbp_rate


def load_exchange_rates(file_path):
    with open(file_path, 'rb') as file:
        return pickle.load(file)


def convert_to_gbp(amount, currency, date, exchange_rates):
    if currency == 'GBP':
        return amount

    to_eur_rate = exchange_rates[date].get(currency, 1)
    amount_in_eur = amount / to_eur_rate
    eur_to_gbp_rate = exchange_rates[date].get('GBP', 1)
    return amount_in_eur * eur_to_gbp_rate


def calculate_daily_portfolio_values(transactions, historical_stock_data, exchange_rates):
    all_transaction_dates = [pd.to_datetime(tx['date']) for txlist in transactions.values() for tx in txlist]
    start_date = min(all_transaction_dates)
    end_date = min([historical_stock_data[ticker].index.max() for ticker in transactions if ticker in historical_stock_data])

    date_range = pd.date_range(start_date, end_date)
    portfolio_values = pd.DataFrame(index=date_range)

    for ticker, txlist in transactions.items():
        suffix = ticker.split('.')[-1] if '.' in ticker else ''
        currency = currency_mapping.get('.' + suffix, 'USD')
        stock_data = historical_stock_data.get(ticker, pd.DataFrame())

        for single_date in date_range:
            if single_date not in stock_data.index and not stock_data.empty:
                last_available_date = stock_data.index[stock_data.index < single_date].max()
                stock_data = stock_data.reindex(date_range, method='ffill')
            stock_value = calculate_stock_value(ticker, txlist, stock_data, exchange_rates, single_date, currency_mapping)
            portfolio_values.at[single_date, ticker] = stock_value

    portfolio_values['Total Portfolio Value'] = portfolio_values.sum(axis=1)
    return portfolio_values.fillna(0)


def calculate_stock_value(ticker, transactions, historical_data, exchange_rates, date, currency_mapping):
    total_shares = 0
    position_sold = False

    suffix = ticker.split('.')[-1] if '.' in ticker else ''
    currency = currency_mapping.get('.' + suffix, 'USD')

    for transaction in transactions:
        transaction_date = pd.to_datetime(transaction['date'])
        if transaction_date <= date:
            if 'sold' in transaction and transaction['sold']:
                position_sold = True
                break
            total_shares += transaction['shares']

    if position_sold or total_shares <= 0:
        return 0

    if date in historical_data.index:
        close_price = historical_data.loc[date, 'Close']
        stock_value = total_shares * close_price

        date_str = date.strftime("%Y-%m-%d")
        if date_str in exchange_rates:
            if currency != 'GBP':
                to_eur_rate = exchange_rates[date_str].get(currency, 1)
                amount_in_eur = stock_value / to_eur_rate
                eur_to_gbp_rate = exchange_rates[date_str].get('GBP', 1)
                return amount_in_eur * eur_to_gbp_rate
            else:
                return stock_value
        else:
            # Skip the calculation if exchange rates are not available for the given date
            return 0
    else:
        # Skip the calculation if historical data is not available for the given date
        return 0


def calculate_daily_dividends(transactions, historical_stock_data, exchange_rates):
    all_transaction_dates = [pd.to_datetime(tx['date']) for txlist in transactions.values() for tx in txlist]
    start_date = min(all_transaction_dates)
    end_date = max([stock_data.index.max() for stock_data in historical_stock_data.values()])

    date_range = pd.date_range(start_date, end_date)
    dividend_values = pd.DataFrame({'Date': date_range, 'Dividends GBP': 0.0})

    for single_date in date_range:
        total_dividends_gbp = 0.0

        for ticker, stock_data in historical_stock_data.items():
            if single_date in stock_data.index and stock_data.loc[single_date, 'Dividends'] > 0:
                suffix = ticker.split('.')[-1] if '.' in ticker else ''
                currency = currency_mapping.get('.' + suffix, 'USD')

                total_shares = calculate_total_shares_held(transactions.get(ticker, []), single_date)
                dividend_amount = total_shares * stock_data.loc[single_date, 'Dividends']
                dividend_gbp = convert_dividend_to_gbp(dividend_amount, currency, single_date, exchange_rates)

                total_dividends_gbp += dividend_gbp

        if total_dividends_gbp > 0:
            dividend_values.loc[dividend_values['Date'] == single_date, 'Dividends GBP'] = total_dividends_gbp

    return dividend_values


def calculate_total_shares_held(transactions, date):
    total_shares = sum(transaction['shares'] for transaction in transactions if pd.to_datetime(transaction['date']) <= date)
    return total_shares


def calculate_cash_position(transactions_dict, exchange_rates_file, historical_data, fx_rates):
    cash_position = 10000
    exchange_rates = load_exchange_rates(exchange_rates_file)

    for ticker, transactions in transactions_dict.items():
        suffix = ticker.split('.')[-1] if '.' in ticker else ''
        currency = currency_mapping.get('.' + suffix, 'USD')

        for transaction in transactions:
            share_price = historical_data[ticker]['Close'].loc[transaction['date']]
            transaction_amount_gbp = convert_to_gbp(transaction['shares'] * share_price, currency, transaction['date'], exchange_rates)
            cash_position -= transaction_amount_gbp

    total_dividends_gbp = calculate_total_dividends(transactions_dict, historical_data, fx_rates)[1]
    cash_position += total_dividends_gbp

    return cash_position


def calculate_daily_cash_position(transactions_dict, exchange_rates, historical_data):
    initial_cash_position = 10000.0

    all_transaction_dates = [pd.to_datetime(tx['date']) for txlist in transactions_dict.values() for tx in txlist]
    start_date = min(all_transaction_dates)
    end_date = max([stock_data.index.max() for stock_data in historical_data.values()])

    daily_cash_positions = pd.DataFrame({'Date': pd.date_range(start_date, end_date), 'Cash Position GBP': initial_cash_position})

    for single_date in pd.date_range(start_date, end_date):
        daily_cash_change = 0.0

        for ticker, transactions in transactions_dict.items():
            suffix = ticker.split('.')[-1] if '.' in ticker else ''
            currency = currency_mapping.get('.' + suffix, 'USD')

            for transaction in transactions:
                transaction_date = pd.to_datetime(transaction['date'])
                if transaction_date == single_date:
                    share_price = historical_data[ticker]['Close'].loc[transaction_date]
                    transaction_amount_gbp = convert_to_gbp_cash(transaction['shares'] * share_price, currency, transaction_date, exchange_rates)
                    daily_cash_change -= transaction_amount_gbp

        if single_date == start_date:
            daily_cash_positions.loc[daily_cash_positions['Date'] == single_date, 'Cash Position GBP'] = initial_cash_position + daily_cash_change
        else:
            prev_day_cash = daily_cash_positions.loc[daily_cash_positions['Date'] == single_date - pd.Timedelta(days=1), 'Cash Position GBP'].values[0]
            daily_cash_positions.loc[daily_cash_positions['Date'] == single_date, 'Cash Position GBP'] = prev_day_cash + daily_cash_change

    return daily_cash_positions


def combine_cash_and_dividends(cash_position_df, dividends_df):
    combined_df = pd.merge(cash_position_df, dividends_df, on='Date', how='left')
    combined_df['Dividends GBP'].fillna(0, inplace=True)
    combined_cash_position = combined_df['Cash Position GBP'].iloc[0]

    for i in range(1, len(combined_df)):
        combined_cash_position += combined_df.loc[i, 'Dividends GBP']
        combined_df.loc[i, 'Cash Position GBP'] = combined_cash_position

    return combined_df


def convert_to_gbp_cash(amount, currency, date, exchange_rates):
    formatted_date = date.strftime("%Y-%m-%d")

    if currency == 'GBP':
        return amount

    to_eur_rate = exchange_rates.get(formatted_date, {}).get(currency, 1)
    amount_in_eur = amount / to_eur_rate
    eur_to_gbp_rate = exchange_rates.get(formatted_date, {}).get('GBP', 1)
    return amount_in_eur * eur_to_gbp_rate


def combine_and_save_data(portfolio_values_df, cash_position_df, dividends_df, file_path="total_portfolio_daily_dump.xlsx"):
    # Reset index to convert the date index to a column
    portfolio_values_df = portfolio_values_df.reset_index().rename(columns={'index': 'Date'})

    # Remove rows where all entries (excluding 'Date') are zero
    portfolio_values_df = portfolio_values_df.loc[(portfolio_values_df.drop(columns=['Date']) != 0).any(axis=1)]
    print(portfolio_values_df.tail())


    # Combine the dataframes
    combined_df = portfolio_values_df.merge(cash_position_df, on='Date')
    combined_df = combined_df.merge(dividends_df, on='Date')

    # Replace NaN values in Dividends column with 0 (for days without dividends)
    combined_df['Dividends GBP'] = combined_df['Dividends GBP'].fillna(0)

    # Calculate cash position without dividends (original cash position)
    combined_df['Cash Position without Dividends GBP'] = combined_df['Cash Position GBP']

    # Calculate cash position with dividends
    combined_df['Cash Position with Dividends GBP'] = combined_df['Cash Position GBP'] + combined_df['Dividends GBP'].cumsum()

    # Calculate total portfolio value with and without dividends
    combined_df['Total Portfolio Value without Dividends'] = combined_df['Total Portfolio Value'] + combined_df['Cash Position without Dividends GBP']
    combined_df['Total Portfolio Value with Dividends'] = combined_df['Total Portfolio Value'] + combined_df['Cash Position with Dividends GBP']

    # Save to Excel file
    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
        combined_df.to_excel(writer, sheet_name='Full Data', index=False)
        summary_df = combined_df[['Date', 'Total Portfolio Value with Dividends', 'Total Portfolio Value without Dividends']]
        summary_df.to_excel(writer, sheet_name='Summary', index=False)
    print(f"Dataframe saved to {file_path} with two sheets: 'Full Data' and 'Summary'")

    return combined_df
