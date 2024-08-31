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
import fjwt, { FastifyJWT } from "@fastify/jwt";

import fCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { uploadProofsOfPayment } from "./routes/uploadProof";
import { uploadQrCode } from "./routes/uploadQrCode";
import { Webhook } from "./routes/Webhook";

const app = fastify();

// aqui determina qual o endereco do front-end que pode consumir nosso servidor
app.register(fastifyCors, {
  origin: "*",
});

// app.register(fjwt, {
//   secret: process.env.JWT_SECRET || "imvinojan02061999xxxx",
// });

// app.addHook("preHandler", (req, res, next) => {
//   req.jwt = app.jwt;
//   return next();
// });

// app.register(fCookie, {
//   secret: process.env.COOKIE_SECRET || "imvinojan02061999xxxx",
//   hook: "preHandler",
// });

// app.decorate(
//   "authenticate",
//   async (request: FastifyRequest, reply: FastifyReply) => {
//     const token = request.cookies.access_token;

//     if (!token) {
//       return reply.status(401).send({ message: "Authentication required" });
//     }

//     const decoded = request.jwt.verify<FastifyJWT["user"]>(token);
//     request.user = decoded;
//   }
// );

// app.register(fastifyMultipart, { attachFieldsToBody: true });
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
