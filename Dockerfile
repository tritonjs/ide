FROM mhart/alpine-node:6.3.0

# native modules.
RUN apk add --update --no-cache make gcc g++ python
RUN apk add git bash
RUN npm install -g pm2

# Add our files & set working dir
ADD . /ide
WORKDIR /ide

RUN chmod +x /ide/serviceinit.sh
RUN npm install

# Environment variables
ENV DEBUG *,-nodemon:*,-nodemon,-express:*,-ioredis:*
ENV DEBUG_COLORS 1
ENV TERM xterm

EXPOSE 80

CMD ["./serviceinit.sh"]
