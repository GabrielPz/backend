import { FastifyInstance } from "fastify";
import { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { BadRequest } from "./_errors/bad-request";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";

const requestBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(6),
});

export async function login(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/login",
    {
      schema: {
        summary: "Login",
        tags: ["User"],
        body: requestBodySchema,
        response: {
          200: z.object({
            token: z.string(),
            id: z.string().uuid(),
            name: z.string(),
            email: z.string().email(),
          }),
          400: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = requestBodySchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
        },
      });

      if (!user) {
        throw new BadRequest("User not found");
      }

      if (user.password != null) {
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          throw new BadRequest("Invalid password");
        }
      }

      const chaveSecreta = process.env.SECRET_KEY_JWT;
      if (!chaveSecreta) {
        throw new Error("Secret key not found");
      }
      const token = jwt.sign({ id: user.id, chaveSecreta }, chaveSecreta, {});

      return reply.status(200).send({
        token: token,
        id: user.id,
        name: user.name,
        email: user.email,
      });
    }
  );
}

export const autenticarToken = async (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) => {
  try {
    const token = request.headers["authorization"];

    if (!token) {
      // console.log("Token não fornecido.");
      return reply.status(401).send({ message: "Token não fornecido." });
    }

    const chaveSecreta = process.env.SECRET_KEY_JWT;
    if (!chaveSecreta) {
      throw new Error("Secret key not found");
    }

    jwt.verify(token, chaveSecreta, (erro: any, dadosDecodificados: any) => {
      if (erro) {
        // console.log("Token inválido:", erro);
        return reply.status(401).send({ message: "Token inválido." });
      }

      //console.log('Dados do usuário decodificados:', dadosDecodificados);
      (request as any).usuario = dadosDecodificados;
      done();
    });
  } catch (error) {
    return reply
      .status(404)
      .send({ error: "Ocorreu um erro ao verificar Token." });
  }
};

// export const autenticarToken = async (
//   request: FastifyRequest,
//   reply: FastifyReply,
//   done: HookHandlerDoneFunction
// ) => {
//   try {
//     const token = request.headers["authorization"]?.split(" ")[1];
//     if (!token) {
//       return reply.status(401).send({ mensagem: "Token não fornecido." });
//     }

//     const chaveSecreta = process.env.SECRET_KEY_JWT;
//     if (!chaveSecreta) {
//       throw new Error("Secret key not found");
//     }

//     const dadosDecodificados = await new Promise((resolve, reject) => {
//       jwt.verify(token, chaveSecreta, (erro: any, decoded: any) => {
//         if (erro) {
//           reject(erro);
//         } else {
//           resolve(decoded);
//         }
//       });
//     });

//     (request as any).usuario = dadosDecodificados;
//     done();
//   } catch (error) {
//     console.error("Authentication error:", error);
//     return reply.status(403).send({ mensagem: "Token inválido." });
//   }
// };
