FROM mhart/alpine-node:latest

# native modules.
RUN apk add --update --no-cache make gcc g++ python git bash


# Add our files & set working dir
ADD . /ide
WORKDIR /ide

RUN chmod +x /ide/serviceinit.sh
RUN npm install

RUN npm install -g pm2

# Expose port 80
EXPOSE 80

CMD ["./serviceinit.sh"]
