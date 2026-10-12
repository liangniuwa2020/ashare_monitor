# 使用官方精简版 Python 3.11 镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置时区为亚洲/上海，确保 A 股交易时间与日志时间准确
ENV TZ=Asia/Shanghai
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8099

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装系统级基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖清单并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制代码与资源
COPY . .

# 暴露服务端口
EXPOSE 8099

# 持久化数据库挂载卷
VOLUME ["/app/ashare_data.db"]

# 启动命令
CMD ["python", "main.py"]
