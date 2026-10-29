# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: diagnostics
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original teaching data: three groups with four independent units per group.
d <- data.frame(id=c(paste0("A",1:4),paste0("B",1:4),paste0("C",1:4)),
                group=factor(rep(c("A","B","C"),each=4)),
                y=c(4,5,7,8,10,11,12,15,15,17,18,22))
fit <- lm(y ~ group,data=d)
# Group means give the one-way fitted values directly.
# Direct subtraction preserves exact ties in this integer teaching example.
d$fitted <- ave(d$y,d$group,FUN=mean)
d$residual <- d$y-d$fitted
stopifnot(max(abs(d$fitted-fitted(fit)))<1e-10,
          max(abs(d$residual-residuals(fit)))<1e-10,
          max(abs(tapply(d$residual,d$group,sum)))<1e-10)
n <- nrow(d)
# Break exact ties by original record order solely to retain observation IDs.
ordered <- order(d$residual,seq_len(n))
position <- seq_len(n)
probability <- ppoints(n)
theoretical <- qnorm(probability)
qq_table <- data.frame(d[ordered,],position=position,
                       probability=probability,theoretical=theoretical)
print(qq_table,digits=10,row.names=FALSE)
selected <- qq_table[qq_table$id=="A4",]
print(selected,digits=10,row.names=FALSE)
stopifnot(selected$fitted==6,selected$residual==2,selected$position==10,
          abs(selected$probability-9.5/12)<1e-12,
          abs(selected$theoretical-.812217801499913)<1e-12)
# qqline uses two sample quantiles, not an OLS fit to every Q-Q point.
quartiles <- quantile(d$residual,c(.25,.75),type=7,names=FALSE)
normal_quartiles <- qnorm(c(.25,.75))
reference_slope <- diff(quartiles)/diff(normal_quartiles)
reference_intercept <- quartiles[1]-reference_slope*normal_quartiles[1]
print(c(Q1=quartiles[1],Q3=quartiles[2],
        slope=reference_slope,intercept=reference_intercept))
q <- qqnorm(d$residual,plot.it=FALSE)
stopifnot(max(abs(q$x[ordered]-theoretical))<1e-12,
          max(abs(q$y-d$residual))<1e-12,
          max(abs(quartiles-c(-1.25,1.25)))<1e-12)
par(mfrow=c(1,2))
plot(d$fitted,d$residual,xlab="Fitted group mean",ylab="Residual")
abline(h=0,lty=2)
points(selected$fitted,selected$residual,pch=19,col="brown")
text(selected$fitted,selected$residual,labels="A4",pos=3)
qqnorm(d$residual)
qqline(d$residual)
points(selected$theoretical,selected$residual,pch=19,col="brown")
text(selected$theoretical,selected$residual,labels="A4",pos=3)
par(mfrow=c(1,1))
# Neither zero group sums nor a straight-looking Q-Q plot proves the assumptions.
