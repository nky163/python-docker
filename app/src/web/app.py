from bottle import Bottle, run
from util import hello as h
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = Bottle()

@app.route('/')
def hello():
    logger.info('Index page accessed')
    return h.hello()

if __name__ == "__main__":
    run(app, host='0.0.0.0', port=80)