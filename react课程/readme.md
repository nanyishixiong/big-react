```
pnpm i eslint -D -w
```

安装命令，-D 是指开发时的依赖不需要打包进产物，-w 因为是 monorepo 项目，安装时要指定安装在根目录的意思

```json
// .eslintrc.json
{
	"env": {
		"browser": true,
		"es2021": true,
		"node": true
	},
	// 有了规则需要设置打开关闭，这里是继承一些推荐的定义好的规则库，不用手动一个个指定开或关
	"extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	// 默认的 eslint 解析器不支持 ts 的解析，需要安装社区的 typescript eslint 解析器
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"ecmaVersion": "latest",
		"sourceType": "module"
	},
	// 规则合集
	"plugins": ["@typescript-eslint"],
	// 零散的规则
	"rules": {}
}
```

```json
// .prettierrc.json
{
	"printWidth": 80,
	"tabWidth": 2,
	"useTabs": true,
	"singleQuote": true,
	"semi": true, // 加分号
	"trailingComma": "none",
	"bracketSpacing": true
}
```

```
pnpm i husky -D -w
```

安装 husky 拦截 commit 命令

```
npx husky add .husky/pre-commit "pnpm lint"
```

执行这条命令，.husky 文件夹下出现一个 pre-commit 文件

```sh
# pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint
```

当执行 commit 之前就会自动执行 pnpm lint 命令
