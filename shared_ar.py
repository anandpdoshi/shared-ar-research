from flask import (Flask, render_template, request,
    redirect, url_for, send_from_directory, make_response, g)
from werkzeug.utils import secure_filename
import string
import random
import os
import sqlite3

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif'])
DATABASE = os.path.join(os.path.dirname(__file__), 'data', 'database.db')

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 16mb max file size
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

def allowed_file(filename):
    return ('.' in filename and
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS)

def random_string(length):
    return ''.join(random.choice(string.ascii_lowercase) for x in range(length))

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('data/schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def insert(table, diction, commit=False):
    db = get_db()
    cols = list(diction.keys())
    values = list(diction.values())
    query = "INSERT INTO {table} ({cols}) VALUES ({values})".format(
        table = table,
        cols = ", ".join(cols),
        values = ", ".join(["?"] * len(values))
    )
    try:
        db.execute(query, values)
    except:
        db.rollback()
        raise
    else:
        if commit:
            db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def after_this_request(f):
    if not hasattr(g, 'after_request_callbacks'):
        g.after_request_callbacks = []
    g.after_request_callbacks.append(f)
    return f

@app.after_request
def call_after_request_callbacks(response):
    for callback in getattr(g, 'after_request_callbacks', ()):
        callback(response)
    return response

@app.before_request
def detect_username():
    username = request.cookies.get('username')
    if not username:
        username = random_string(64)
        insert("Users", {"UserId": username}, commit=True)

        @after_this_request
        def set_username(response):
            response.set_cookie('username', username)

    g.username = username

@app.route('/', methods=['GET'])
def index():
    data = load_data()
    return render_template('index.html', data=data)

def load_data():
    results = query_db("""select * from Uploads
        where UserId=? or Layer='Public'
        order by Marker asc, Timestamp asc""", (g.username,))

    data = {}
    for r in results:
        if r['Marker'] not in data:
            data[r['Marker']] = {}

        if r['Layer'] not in data[r['Marker']]:
            data[r['Marker']][r['Layer']] = []

        r = dict(r)
        r['uploaded'] = url_for('uploaded_file', filename=r['Content'])

        data[r['Marker']][r['Layer']].append(r)

    return data

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'error'

    file = request.files['file']
    marker = request.form['marker']
    print('before layer', request.form['public'])
    layer = int(request.form['public']) and 'Public' or 'Private'
    print('after layer')
    # print(request.form)
    #
    # print(request.form['marker'])
    # print(file.filename)

    # return ''

    if file.filename == '':
        resp_string =  'no filename'

    elif file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filename_parts = filename.rsplit('.', 1)
        filename_parts.insert(1, random_string(10))
        filename = "{0}{1}.{2}".format(*filename_parts)

        try:
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        except:
            resp_string = "error in saving file"
            print('except block!')
            raise
        else:
            insert(
                "Uploads",
                {
                    "UserId": g.username,
                    "Content": filename,
                    "Marker": marker,
                    "Layer": layer or "Private"
                },
                commit=True
            )

            resp_string = url_for('uploaded_file', filename=filename)

    else:
        resp_string = 'nothing to upload'

    return resp_string

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(use_reloader=1, threaded=True)
