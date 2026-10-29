# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: factorial-simple-effects
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Family chosen before observing outcomes: A2 - A1 within each B level.
d <- data.frame(
  A=factor(rep(c("A1", "A2"), each=12)),
  B=factor(rep(rep(c("B1", "B2", "B3"), each=4), times=2)),
  y=rep(c(10, 10, 10, 10, 14, 18), each=4) +
    rep(c(-1.5, -.5, .5, 1.5), times=6))
fit <- aov(y ~ A*B, data=d)
summary(fit)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
cell_mean <- with(d, tapply(y, list(A, B), mean))
cell_n <- with(d, table(A, B))
cell_mean
estimate <- cell_mean["A2", ] - cell_mean["A1", ]
se <- sqrt(mse*(1/cell_n["A2", ] + 1/cell_n["A1", ]))
t_value <- estimate/se
p_raw <- 2*pt(-abs(t_value), df=error_df)
family_size <- length(estimate)
critical <- qt(1-.05/(2*family_size), df=error_df)
data.frame(B=colnames(cell_mean), estimate=estimate, SE=as.numeric(se),
           df=error_df, t=as.numeric(t_value),
           slice_F=as.numeric(t_value^2), p_raw=as.numeric(p_raw),
           p_bonferroni=p.adjust(as.numeric(p_raw), method="bonferroni"),
           simultaneous_lower=as.numeric(estimate-critical*se),
           simultaneous_upper=as.numeric(estimate+critical*se),
           row.names=NULL)
