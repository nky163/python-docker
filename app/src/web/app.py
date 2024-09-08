from bottle import Bottle, run
from util import hello as h
import logging
import os
import mysql.connector
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()

# mysql_host = os.getenv('MYSQL_HOST')
# mysql_user = os.getenv('MYSQL_USER')
# mysql_password = os.getenv('MYSQL_PASSWORD')
# mysql_database = os.getenv('MYSQL_DATABASE')
# conn = mysql.connector.connect(
#     host=mysql_host,
#     user=mysql_user,
#     password=mysql_password,
#     database=mysql_database
# )
app = Bottle()

@app.route('/')
def hello():
    logger.info('Index page accessed')
    # cursor = conn.cursor()
    # cursor.execute("SELECT 'Hello, World! from MySQL'")
    # result = cursor.fetchone()
    # cursor.close()
    # conn.close()
    return 'aaaa'

if __name__ == "__main__":
    run(app, host='0.0.0.0', port=80)