# Original five-level example, with three independent units at each x.
d <- data.frame(x=rep(0:4,each=3),
                y=rep(c(3,4,8,13,22),each=3)+rep(c(-1,0,1),5))
line <- lm(y~x,data=d)
quadratic <- lm(y~x+I(x^2),data=d)
cell <- lm(y~factor(x),data=d)
sst <- sum((d$y-mean(d$y))^2)
sse_line <- deviance(line)
sse_quad <- deviance(quadratic)
ss_pe <- deviance(cell)
mse_quad <- sse_quad/df.residual(quadratic)
ms_pe <- ss_pe/df.residual(cell)
F_values <- c(overall=((sst-sse_quad)/2)/mse_quad,
              extra_quadratic=(sse_line-sse_quad)/mse_quad,
              lack_of_fit=((sse_quad-ss_pe)/2)/ms_pe)
results <- data.frame(test=names(F_values),F=unname(F_values),
                      df1=c(2,1,2),df2=c(12,12,10),
                      denominator=c(mse_quad,mse_quad,ms_pe))
results$P <- pf(results$F,results$df1,results$df2,lower.tail=FALSE)
print(c(SST=sst,SSE_line=sse_line,SSE_quadratic=sse_quad,SSPE=ss_pe))
print(results,digits=12)
print(summary(quadratic)$coefficients)
print(anova(line,quadratic))
print(anova(quadratic,cell))
# The quadratic coefficient t corresponds to the one-df extra-term test.
t_quad <- summary(quadratic)$coefficients["I(x^2)","t value"]
stopifnot(df.residual(quadratic)==12,df.residual(cell)==10,
          abs(mse_quad-.947619047619048)<1e-12,abs(ms_pe-1)<1e-12,
          abs(F_values["extra_quadratic"]-t_quad^2)<1e-10,
          max(abs(F_values-c(382.341708542714,65.3517587939699,.685714285714278)))<1e-9,
          max(abs(results$P-c(1.36026423773983e-11,3.37784818863505e-6,.525926266406393)))<1e-12)
answer <- 1L
print(answer)

