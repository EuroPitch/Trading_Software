# EuroPitch Trading Software

## Introduction

Welcome to the Trading Software for EuroPitch. This Python-based tool is designed to streamline and enhance the management of our investment portfolio. This project aims to be a valuable resource for members of the SMIF interested in computer science and intended to provide a gateway to working with Python in finance.

### Features

- Adjustable transactions (`transactions.json`)for when a stock is bought or sold
- Daily updates on all of the portfolio's positions
- Generation of a weekly report
- Tracking of dividends
- Tracking of cash position

## Motivation and Background

This project was initiated to address the need for a more streamlined and accessible tool for managing our portfolio. It is supposed to be used by students who are interested in finance and computer science. The project is intended to be a resource for members of the SMIF interested in computer science; a place where they can apply their skills to a real-world (ish) scenario.

## How does it work?

- Download the latest data of all of the positions by running `python3 main.py -download`
This uses the Yahoo Finance package (not the api technically) to get the latest data of all the stocks and puts them into `downloaded_data.pkl`

- Download the latest exchange rate data by running `python3 update_data.py` and then `python3 convert_csv.py`
This get the latest exchange rate data from the ECB's published historical data. By running `convert_csv.py` it will merge that downloaded data with the `ecb_daily.pkl` which stores the daily fx data going back to the early 2000s.
*note*
`update_data.py` is a shell script for now but I'm working on making it into a python script to also make it work on Windows. In the future `main.py` should be able to update the data (like It is done now with the -download flag for stock data) without having to run all those files on their own.

- With all the data updated you can run `python3 main.py --daily-dump or --weekly-report` to produce the daily dump or weekly report respectively.

- I'm using cron and rclone to run the script at specified times and then upload the data to our SMIF google drive.

## Installation and Setup

To set up the Trading Software, follow these steps:

1. Clone the repository:

`git clone https://github.com/matat99/portfolio_mgr.git`

2. Install the required packages:
`cd portfolio_mgr`

`pip install -r requirements.txt`


## To Do
- [ ] Make the README actually useful
- [ ] Implement a way to track stock splits
- [ ] Make this work on Windows
- [ ] Incorporate some modeles
- [ ] Maybe a UI?
- [ ] Make the fx data update less tedious.
- [ ] Clean up unused imports and de-bloat requirements.txt.


## Contributors

This Project was created by Maciej Miazek (mam00961@students.stir.ac.uk), further developed by Raj Aryan Upadhyaya (upadhyra@tcd.ie)
