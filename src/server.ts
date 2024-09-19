import { fastify, FastifyReply, FastifyRequest } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";
import { errorHandler } from "./error-handler";
import { autenticarToken, login } from "./routes/Auth";
import { orderRoutes } from "./routes/Orders";
import { proofOfPaymentRoutes } from "./routes/ProofOfPayments";
import { qrCodeRoutes } from "./routes/QrCodes";
import { userRoutes } from "./routes/Users";
import { yuanRoutes } from "./routes/YuanConfig";
import fastifyRawBody from "fastify-raw-body";

import { uploadProofsOfPayment } from "./routes/uploadProof";
import { uploadQrCode } from "./routes/uploadQrCode";
import { Webhook } from "./routes/Webhook";

const app = fastify();

// aqui determina qual o endereco do front-end que pode consumir nosso servidor
app.register(fastifyCors, {
  origin: "*",
});

app.register(fastifyRawBody, {
  runFirst: true,
  global: false,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(Webhook);
app.register(login);
app.register(orderRoutes);
app.register(uploadProofsOfPayment);
app.register(uploadQrCode);
app.register(proofOfPaymentRoutes);
app.register(userRoutes);
app.register(qrCodeRoutes);
app.register(yuanRoutes);
app.setErrorHandler(errorHandler);

app.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server is running on port 3000");
});
