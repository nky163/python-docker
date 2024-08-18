from bottle import Bottle, run
from util import hello as h

app = Bottle()

@app.route('/')
def hello():
    return h.hello()

if __name__ == "__main__":
    run(app, host='0.0.0.0', port=80)