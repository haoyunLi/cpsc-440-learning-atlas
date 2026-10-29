means <- c(control=10,A=13,B=11)
weights <- c(-1,0.5,0.5); n <- c(5,5,5); mse <- 9
estimate <- sum(weights*means)
se <- sqrt(mse*sum(weights^2/n))
answer <- estimate/se
print(c(estimate=estimate,SE=se,t=answer,F=answer^2,
        p=2*pt(-abs(answer),sum(n)-length(n))))
