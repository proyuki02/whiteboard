# Whiteboard

A simple collaborative whiteboard.

![capture](https://user-images.githubusercontent.com/40527123/78779832-9c46bd80-79d8-11ea-965d-469890624175.png)

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

Optionally, If you want to change the expiration time (seconds) of the board, set the `REDIS_TTL_SEC` env variable. (Default is 30 days)

```
$ REDIS_URL=redis://localhost:6379 REDIS_TTL_SEC=86400 npm start
```

## Features

- Draw on the whiteboard and all other users will see you drawings live.
- Sticky notes with signature support.
- Multiple whiteboards support.
- Undo/Redo support.
- Redis support (optional).

## References

- [Socket.IO Collaborative Whiteboard](https://socket.io/demos/whiteboard/)
- [Web Whiteboard](https://www.webwhiteboard.com)
- [オンラインふせんアプリを作りたい人のためのファーストガイド - Qiita](https://qiita.com/iotas/items/fbf4994877e5c2053787)

## License

MIT
