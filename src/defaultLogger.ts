import winston from 'winston';

export const createDefaultLogger = () => {
  return winston.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
    level: 'info',
  });
};
