# Original teaching data, with four independent units per group.
d <- data.frame(id=c(paste0("A",1:4),paste0("B",1:4),paste0("C",1:4)),
                group=factor(rep(c("A","B","C"),each=4)),
                y=c(3,7,10,12,11,15,18,24,21,22,28,29))
fit <- lm(y ~ group,data=d)
# Direct group subtraction preserves exact ties in these integer data.
d$fitted <- ave(d$y,d$group,FUN=mean)
d$residual <- d$y-d$fitted
stopifnot(max(abs(d$fitted-fitted(fit)))<1e-10,
          max(abs(d$residual-residuals(fit)))<1e-10)
n <- nrow(d)
# Keep IDs when sorting; break exact residual ties by original record order.
ordered <- order(d$residual,seq_len(n))
probability <- ppoints(n)
stopifnot(max(abs(probability-(seq_len(n)-.5)/n))<1e-12)
qq_table <- data.frame(d[ordered,],position=seq_len(n),
                       probability=probability,theoretical=qnorm(probability))
print(qq_table,digits=12,row.names=FALSE)
selected <- qq_table[qq_table$id=="A3",]
print(selected,digits=12,row.names=FALSE)
# Independently check the selected point against base R's Q-Q calculation.
qq <- qqnorm(d$residual,plot.it=FALSE)
selected_row <- which(d$id=="A3")
stopifnot(selected$fitted==8,selected$residual==2,selected$position==8,
          selected$probability==.625,
          abs(selected$theoretical-.318639363964375)<1e-12,
          abs(qq$x[selected_row]-selected$theoretical)<1e-12,
          qq$y[selected_row]==selected$residual)
# Compute plausible wrong routes rather than treating them as valid coordinates.
raw_position <- match(selected_row,order(d$y,seq_len(n)))
reverse_position <- match(selected_row,order(-d$residual,seq_len(n)))
wrong_raw <- qnorm(probability[raw_position])
wrong_reverse <- qnorm(probability[reverse_position])
print(c(raw_position=raw_position,wrong_raw=wrong_raw,
        reverse_position=reverse_position,wrong_reverse=wrong_reverse),digits=12)
stopifnot(raw_position==3,reverse_position==5,
          abs(wrong_raw-(-.812217801499913))<1e-12,
          abs(wrong_reverse-(-.318639363964375))<1e-12)
# A plotting probability is not a test P-value or proof of any assumption.
answer <- unname(selected$theoretical)
print(answer,digits=12)

