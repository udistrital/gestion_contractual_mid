FROM sleavely/node-awscli:18.x

WORKDIR /
COPY dist dist
COPY node_modules node_modules
COPY entrypoint.sh entrypoint.sh
RUN chmod +x ./ entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
