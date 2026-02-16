"""
News microservice module for fetching and processing stock news articles.
"""

from .news_service import fetch_news, fetch_and_save_news, print_news

__all__ = ['fetch_news', 'fetch_and_save_news', 'print_news']
