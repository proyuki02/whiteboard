# Whiteboard

A simple collaborative whiteboard.

## How to use

```
$ npm i
$ npm start
```

And point your browser to `http://localhost:3000`.  
Optionally, specify a port by supplying the `PORT` env variable.

### Store data in Redis server

Set env of Redis server to `REDIS_URL`.

```
$ docker run --name redis -d -p 6379:6379 redis redis-server --appendonly yes
$ REDIS_URL=redis://localhost:6379 npm start
```

Optionally, specify the prefix for the key by specifying the `REDIS_PREFIX` env variable. (Default is `whiteboard-`)

```
$ REDIS_URL=redis://localhost:6379 REDIS_PREFIX=whiteboard- npm start
```

## Features

- Works standalone.
- Draw on the whiteboard and all other users will see you drawings live.
- Sticky notes with signature support.
- Redis support (optional).

## References

- [Socket.IO Collaborative Whiteboard](https://socket.io/demos/whiteboard/)
- [Web Whiteboard](https://www.webwhiteboard.com)
- [オンラインふせんアプリを作りたい人のためのファーストガイド - Qiita](https://qiita.com/iotas/items/fbf4994877e5c2053787)

## License

MIT
