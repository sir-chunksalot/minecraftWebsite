import aiohttp_session as sessions
import socketio
from aiohttp import web
from aiohttp_session.cookie_storage import EncryptedCookieStorage
import json
from http.cookies import SimpleCookie
import asyncio
import aiohttp_jinja2
import jinja2
import subprocess #lets us open up mc server to do stuff
import os
import threading
import re
import websocket
import typing
import signal

# TODO: make readable
# html is bento box, css is the food, python is the table, and js is the waiter/fork/spoon

#r makes it so the escape sequences dont apply
java_path = r'C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot\bin\java'
server_path = r'./server'
server_jar = 'server.jar'

process: subprocess.Popen[bytes] = None
process_lock = threading.Lock()
icode: 'EyeSocketClient' = None


class PlayerData(typing.TypedDict):
    gamemode: str
    pvp: bool
    name: str


class HomeView(web.View):#also a restful system
    @aiohttp_jinja2.template('index.jinja2') #decorator - adds stuff to method to the beginning or the end used to add features 
    async def get(self):
        print('handle')
        return {'server_ip': 'serverip.net.net.net.mc'} #{} is dictionary of everythng jinja has access to, server_ip is variable: colon tells it to turn into "serveripnet"
    #DICTIONARY DEFINITONS 


sio = socketio.AsyncServer(cors_allowed_origins='*')
app = web.Application()
aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('./views'))  #boots up jinja
app.router.add_view("/", HomeView)
app.router.add_static("/static", "./static") #adds static path server side 
sio.attach(app)


@sio.event
async def connect(sid, environment: dict, auth):
    print('connected ' + str(sid))
    await sio.emit('server_state', process is not None)
    if icode and not icode.is_closed:
        icode.socket.send(json.dumps({"event": "gamerules"}))
        icode.socket.send(json.dumps({"event": "players"}))
        print('icode events sent')


@sio.on('start_server') #when socket recieves start server then start mc server
async def on_start_server(sid):
    threading.Thread(target=open_mc_server, args=(asyncio.get_event_loop(), sio)).start() #sio is the socket server
    await sio.emit('server_state', True)


@sio.on('send_command')
async def on_send_command(sid, command: str):
    send_mc_command(command)


@sio.on('stop_server')
async def on_stop_server(sid):
    stop_mc_server()
    await sio.emit('server_state', False)


# websocket client for icode minecraft server
class EyeSocketClient:
    def __init__(self, loop: asyncio.AbstractEventLoop, sio: socketio.AsyncServer) -> None:
        self.socket = websocket.WebSocketApp(
            url='ws://localhost:5555',
            on_open=lambda app: self.on_open(app),
            on_message=lambda app, msg: self.on_message(app, msg),
            on_error=lambda app, err: self.on_error(app, err),
            on_close=lambda app, code, msg: self.on_close(app, code, msg),
        )
        self.loop = loop
        self.sio = sio
        self.is_closed = False

    def on_open(self, socket: websocket.WebSocketApp):
        print('client connected!!!!')
        self.socket.send(json.dumps({"event": "gamerules"}))

    def on_message(self, socket: websocket.WebSocketApp, message: str):
        print(message)
        message: dict = json.loads(message)
        event = message['event']
        if event == 'players':
            data: list[PlayerData] = message['data']
            asyncio.run_coroutine_threadsafe(sio.emit('players', data), self.loop)
        elif event == 'gamerules':
            data = message['data']
            asyncio.run_coroutine_threadsafe(sio.emit('gamerules', data), self.loop)

            
    def on_error(self, socket: websocket.WebSocketApp, error):
        print('client dead :(((((((!!!! ' + str(error))

    def on_close(self, socket: websocket.WebSocketApp, code, message):
        print('client dead!!!!' + str(message))
        self.is_closed = True

    def close(self):
        self.is_closed = True

    def run(self):
        threading.Thread(target=self.socket.run_forever, kwargs={'reconnect': 5}, daemon=True).start()


def open_mc_server(loop: asyncio.AbstractEventLoop, sio: socketio.AsyncServer): #for mc server
    global icode
    print('starting mc server')
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    global process #process is the connection to the mc server
    with process_lock: #with opens and closes when it is done, 
        if process is None:
            process = subprocess.Popen([java_path, '-jar', server_jar, 'nogui'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=server_path) #stdinm is input, stdout is output, cwd is current working directory 
        else:
            return
    icode = EyeSocketClient(loop, sio)
    line = process.stdout.readline().decode().rstrip('\n')
    while line: #checks to see if there is a line
        print(line)
        line = ansi_escape.sub('', line)
        asyncio.run_coroutine_threadsafe(sio.emit('console', line), loop)
        if '[ICraft] Socket server started on' in line:
            icode.run()
        line = process.stdout.readline().decode().rstrip('\n') #reads line by line and sends new lines to client
    print('no more ouput')

    icode.close()
    icode = None


def stop_mc_server():
    print('stopping mc server')
    global process
    with process_lock:
        if process is not None:
            # send_mc_command('stop')
            process.kill()
            process.wait()
            process = None


def kill_mc_server():
    print('killing mc server')
    global process
    with process_lock:
        if process is not None:
            process.kill()
            process.wait()
            process = None


def send_mc_command(command: str):
    print(f'/{command}')
    with process_lock:
        if process is not None:
            command += '\r\n' #\r\n indicates end of line
            process.stdin.write(command.encode()) #turns it into bytes
            process.stdin.flush()#clears the buffer to prevent memory leaks


async def main():
    runner = web.AppRunner(app) 
    await runner.setup() 
    site = web.TCPSite(runner, '0.0.0.0', 8080) #tcp is a way of sending data. tcp is for websites. udp is another way of sending data, bedrock edition uses it 
    await site.start()
    loop = asyncio.get_event_loop()
    try:
        while True:
            await asyncio.sleep(1) #all of this is so program doesnt kill itself right after startign
    except (KeyboardInterrupt, SystemExit):
        print('stopping')
    stop_mc_server()

if __name__ == '__main__': #this is main method. underscores are conventions. if i click run this if statement is true. you dont REALLY need it it is mostly just for conventions 
    asyncio.run(main())
