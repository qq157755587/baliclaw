# 学习笔记 02：理解 Node 中的异步、`Promise`、`async/await`

这篇笔记围绕当前项目中的这行代码展开：

```ts
await program.parseAsync(process.argv);
```

目标不是分析 CLI 业务逻辑，而是理解 Node/JavaScript 里的异步机制本身。

## 1. 先建立一个总认识

Node 里的异步可以先分成两层理解：

1. JavaScript 语言层面的 `Promise`、`async`、`await`
2. Node runtime 层面的事件循环（event loop）和异步 I/O

阅读工程代码时，最常直接看到的是第一层：

- `Promise<T>`
- `async function`
- `await xxx`

而这些语法之所以重要，是因为 Node 运行时本身非常强调异步 I/O。

## 2. 为什么 Node 里异步这么常见

Node 经常处理的任务包括：

- 读写文件
- 发网络请求
- 等待定时器
- 访问数据库
- 和其他进程通信
- 调用 SDK

这些任务有一个共同点：

- 结果通常不会“立刻”拿到

如果程序采用完全同步阻塞的方式，很多时间都会浪费在等待上。

所以 Node 的设计很重视：

- 不要让 JavaScript 主执行流一直傻等
- 先把“等待”交给底层 runtime 或操作系统
- 等结果回来后，再继续后续逻辑

这就是异步编程在 Node 中非常重要的原因。

## 3. `Promise` 是什么

可以先把 `Promise` 理解成：

- 一个“未来才会完成”的结果对象

例如：

```ts
const p: Promise<number> = Promise.resolve(42);
```

这里 `p` 不是数字 `42`，而是一个“将来能拿到 `42`”的承诺。

所以：

- 普通值：现在就有
- `Promise`：以后会有

这是理解 `async/await` 的基础。

## 4. 普通函数和 `async` 函数的区别

普通函数：

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

返回值是：

- `number`

`async` 函数：

```ts
async function addAsync(a: number, b: number): Promise<number> {
  return a + b;
}
```

虽然代码里写的是 `return a + b`，但因为函数被标记为 `async`，它的返回值会自动包装成：

- `Promise<number>`

可以先记一句：

- `async function` 一定返回 `Promise`

如果函数内部抛出异常，也不会像普通函数那样直接往外抛，而是会变成一个 rejected Promise。

## 5. `await` 是什么

`await` 的作用是：

- 等待一个 Promise 完成
- 拿到 Promise 最终解析出来的值

例如：

```ts
const value = await Promise.resolve(42);
```

执行后：

- `value` 会变成 `42`

所以 `await` 可以理解成：

- 把“未来的结果”取出来，变成“当前可用的结果”

## 6. `await` 暂停的是谁

这是最关键的理解点之一。

看一个例子：

```ts
async function main() {
  console.log("A");
  const value = await Promise.resolve(42);
  console.log(value);
  console.log("B");
}

main();
console.log("C");
```

这里不要把 `await` 理解成“冻结整个程序”。

更准确的理解是：

- `await` 暂停的是 `main()` 这个 async 函数后续的执行
- 不是把整个 Node 进程全部阻塞住

所以外面的：

```ts
console.log("C");
```

仍然可以继续执行。

先记住一句话：

- `await` 只挂起当前异步执行流，不等于阻塞整个程序

## 7. Node 为什么说是“单线程”，却还能高效处理很多任务

Node 常被称为：

- 单线程事件循环模型

这里的“单线程”主要是指：

- JavaScript 主执行线程通常是一条

但这不等于：

- 所有事情都必须在这条线程里傻等

Node 处理异步任务的大体方式可以粗略理解为：

1. JavaScript 发起一个异步操作，例如读文件
2. 等待过程交给底层 runtime/系统
3. JavaScript 主线程先继续处理别的事情
4. 异步结果准备好了，再把后续逻辑安排回来执行

所以 Node 的强项是：

- 高效处理 I/O 等待
- 高并发连接
- 大量“现在没结果，但稍后会回来”的任务

Node 的弱项通常是：

- 特别重的 CPU 计算

因为那种工作会长时间占住 JavaScript 主执行流。

## 8. 事件循环（event loop）先怎么理解

不用一开始就追很深。

第一版理解足够了：

- Node 里有一个持续运转的调度机制
- 它负责查看哪些异步任务完成了
- 完成了就安排对应的后续代码执行

这就是常说的事件循环。

后面如果继续深入，再去区分：

- macrotask
- microtask
- Promise job queue
- timer phase

当前阶段先不用展开。

## 9. 顶层 `await` 是什么

在现代 ESM 模块里，可以直接在模块最外层写：

```ts
await something();
```

这叫：

- top-level await

也就是“顶层 `await`”。

以前很多代码必须写成：

```ts
async function main() {
  await something();
}

main();
```

现在在 ESM 模块里可以直接写：

```ts
await something();
```

这会让模块初始化阶段本身带有异步等待。

## 10. 当前项目里的这句代码是什么意思

在 [`src/cli/index.ts`](../src/cli/index.ts) 里有：

```ts
await program.parseAsync(process.argv);
```

它的含义更准确地说是：

- 当前 ESM 模块在顶层等待 `parseAsync(...)` 完成

而不是：

- “这个文件被某个外层 async 函数调用了”

也不是：

- “整个 Node 进程被同步阻塞住了”

应该理解为：

- 模块开始执行
- 执行到这句时，需要等待命令解析和对应异步 action 完成
- 完成后，这个模块的顶层执行才结束

## 11. 为什么这里是 `parseAsync()` 而不是 `parse()`

因为这个 CLI 里注册的 action 是异步的。

例如：

```ts
.action(async () => {
  console.log(await runStatusCommand());
});
```

既然 action 函数本身是 `async`，那么 commander 就需要异步版本的解析执行入口：

```ts
await program.parseAsync(process.argv);
```

这样它才能正确等待命令执行完成。

## 12. 异步不等于“并行”

这是一个常见误区。

异步更准确表示：

- 程序不必阻塞等待一个慢操作完成

它不自动等于：

- 同时在多个 CPU 核上并行执行很多 JS 代码

所以要区分：

- 异步：关注等待和调度
- 并行：关注多个任务真正同时执行

Node 很擅长异步 I/O，但这不代表 JS 主逻辑天然就有多线程并行能力。

## 13. 当前阶段最重要的结论

先记住这几条就够了：

1. `Promise` 是“未来的结果”。
2. `async function` 总是返回 `Promise`。
3. `await` 用来等待 `Promise`，但只暂停当前 async 执行流。
4. Node 强调异步，是为了高效处理 I/O 等待。
5. Node 常说的“单线程”主要是指 JavaScript 主执行线程。
6. 顶层 `await` 是 ESM 模块提供的能力。
7. 当前项目里的 `await program.parseAsync(process.argv)` 是模块顶层异步等待，不是“别人异步调用了这个文件”。

## 14. 下一步建议

下一步适合继续看的文件是：

- [`src/cli/client.ts`](../src/cli/client.ts)

因为那里会把“CLI 发起一个异步请求”这件事变得更具体，例如：

- 为什么一个 CLI 命令会返回 `Promise`
- CLI 如何和其他模块或 daemon 交互
