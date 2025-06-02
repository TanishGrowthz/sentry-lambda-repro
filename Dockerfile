FROM public.ecr.aws/lambda/nodejs:22 AS builder
WORKDIR /build
COPY . /build
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --verbose
RUN pnpm run build

FROM public.ecr.aws/lambda/nodejs:22
# Copy function code and node_modules recursively
COPY --from=builder /build/dist ${LAMBDA_TASK_ROOT}/
COPY --from=builder /build/src/instrument.js ${LAMBDA_TASK_ROOT}/
COPY --from=builder /build/node_modules ${LAMBDA_TASK_ROOT}/node_modules

ENV NODE_OPTIONS="--import ./instrument.js"
  
# Set the CMD to your handler
CMD [ "lambda.handler" ]
