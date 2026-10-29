# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: lack-fit
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Continue the original four-level example with all 12 observations.
d <- data.frame(x=rep(1:4,each=3),
                y=c(2,3,4,5,6,7,10,11,12,18,19,20))
line <- lm(y~x,data=d)
quadratic <- lm(y~x+I(x^2),data=d)
cell <- lm(y~factor(x),data=d)
n <- nrow(d)
g <- length(unique(d$x))
sst <- sum((d$y-mean(d$y))^2)
sse_line <- deviance(line)
sse_quad <- deviance(quadratic)
ss_pe <- deviance(cell)
df_quad <- df.residual(quadratic)
df_pe <- df.residual(cell)
mse_quad <- sse_quad/df_quad
ms_pe <- ss_pe/df_pe
# Each numerator and denominator correspond to the named nested models.
f_overall <- ((sst-sse_quad)/2)/mse_quad
f_increment <- ((sse_line-sse_quad)/1)/mse_quad
f_lof <- ((sse_quad-ss_pe)/(g-3))/ms_pe
results <- data.frame(
  test=c("Overall quadratic", "Add quadratic term", "Quadratic lack of fit"),
  F=c(f_overall,f_increment,f_lof),
  df1=c(2,1,g-3), df2=c(df_quad,df_quad,df_pe),
  denominator=c(mse_quad,mse_quad,ms_pe))
results$P <- pf(results$F,results$df1,results$df2,lower.tail=FALSE)
print(results,digits=12)
print(summary(quadratic)$coefficients,digits=12)
print(anova(line,quadratic))
print(anova(quadratic,cell))
# Only the one-df extra-term F equals the quadratic coefficient's t squared.
out <- summary(quadratic)
t_linear <- unname(out$coefficients["x","t value"])
t_quadratic <- unname(out$coefficients["I(x^2)","t value"])
print(c(overall_F=f_overall,linear_t_squared=t_linear^2,
        quadratic_t_squared=t_quadratic^2,extra_term_F=f_increment))
stopifnot(abs(f_overall-out$fstatistic[[1]])<1e-10,
          abs(f_increment-t_quadratic^2)<1e-10,
          abs(f_increment-anova(line,quadratic)[2,"F"])<1e-10,
          abs(f_lof-anova(quadratic,cell)[2,"F"])<1e-10,
          max(abs(results$F-c(243,20.7055214723926,.15)))<1e-10,
          all(results$df1==c(2,1,1)),all(results$df2==c(9,9,8)),
          max(abs(results$P-c(1.47356024853655e-8,.00138528111602133,.708635400193931)))<1e-12)
# Pearson r uses the original X and Y; quadratic R-squared includes X squared.
r_squared <- cor(d$x,d$y)^2
print(c(Pearson_r_squared=r_squared,R2_line=summary(line)$r.squared,
        R2_quadratic=out$r.squared))
stopifnot(abs(summary(line)$r.squared-r_squared)<1e-12,
          abs(out$r.squared-.981818181818182)<1e-12,
          abs(out$r.squared-r_squared)>.04)
# The linear coefficient is not a constant rate of change in a quadratic model.
b <- coef(quadratic)
x0 <- 1:4
fitted <- as.numeric(predict(quadratic,data.frame(x=x0)))
local_rate <- unname(b[2]+2*b[3]*x0)
print(data.frame(x=x0,fitted_mean=fitted,local_rate=local_rate))
print(data.frame(from=1:3,to=2:4,one_unit_change=diff(fitted)))
stopifnot(max(abs(fitted-c(3.05,5.85,11.15,18.95)))<1e-10,
          all(diff(fitted)>0),all(local_rate>0),b[2]<0)
# The intervals remain conditional on the prespecified model and its errors.
# A nonsignificant lack-of-fit test does not establish the model as true.
